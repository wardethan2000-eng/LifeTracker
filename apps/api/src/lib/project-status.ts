import type { Prisma } from "@prisma/client";
import type { PrismaExecutor } from "./prisma-types.js";


type TaskCompletionShape = {
  status: string;
  taskType: string | null;
  isCompleted: boolean | null;
};

type PhaseStatusShape = {
  id: string;
  name: string;
  status: string;
  actualEndDate: Date | null;
  tasks: TaskCompletionShape[];
  supplies: Array<{ isProcured: boolean }>;
};

export interface PhaseCompletionSummary {
  phaseId: string;
  projectId: string;
  phaseName: string;
  pendingTaskCount: number;
  unprocuredSupplyCount: number;
  trackedItemCount: number;
  canComplete: boolean;
}

export interface ProjectCompletionSummary {
  projectId: string;
  projectName: string;
  incompletePhaseCount: number;
  incompletePhaseNames: string[];
  pendingUnphasedTaskCount: number;
  trackedItemCount: number;
  canComplete: boolean;
}

export interface ProjectStatusSyncResult {
  projectId: string;
  projectStatus: string;
  phaseStatuses: Array<{ phaseId: string; status: string }>;
}

const isTaskCompleted = (task: TaskCompletionShape): boolean => (
  task.status === "completed" || ((task.taskType ?? "full") === "quick" && Boolean(task.isCompleted))
);

const pluralize = (count: number, singular: string, plural = `${singular}s`): string => (
  `${count} ${count === 1 ? singular : plural}`
);

const summarizePhase = (phase: PhaseStatusShape): Omit<PhaseCompletionSummary, "projectId"> => {
  const pendingTaskCount = phase.tasks.filter((task) => !isTaskCompleted(task)).length;
  const unprocuredSupplyCount = phase.supplies.filter((supply) => !supply.isProcured).length;

  return {
    phaseId: phase.id,
    phaseName: phase.name,
    pendingTaskCount,
    unprocuredSupplyCount,
    trackedItemCount: phase.tasks.length + phase.supplies.length,
    canComplete: pendingTaskCount === 0 && unprocuredSupplyCount === 0
  };
};

const phaseHasStarted = (phase: PhaseStatusShape): boolean => (
  phase.tasks.some((task) => (
    isTaskCompleted(task)
    || task.status === "in_progress"
    || task.status === "skipped"
  ))
  || phase.supplies.some((supply) => supply.isProcured)
);

const deriveReopenedPhaseStatus = (phase: PhaseStatusShape): string => (
  phaseHasStarted(phase) ? "in_progress" : "pending"
);

const isClosedPhaseStatus = (status: string): boolean => status === "completed" || status === "skipped";

export const buildPhaseCompletionGuardrailMessage = (summary: PhaseCompletionSummary): string => {
  const fragments: string[] = [];

  if (summary.pendingTaskCount > 0) {
    fragments.push(`${pluralize(summary.pendingTaskCount, "task")} still pending`);
  }

  if (summary.unprocuredSupplyCount > 0) {
    fragments.push(`${pluralize(summary.unprocuredSupplyCount, "supply", "supplies")} still unprocured`);
  }

  return `Cannot mark phase complete while ${fragments.join(" and ")}.`;
};

export const buildProjectCompletionGuardrailMessage = (summary: ProjectCompletionSummary): string => {
  const fragments: string[] = [];

  if (summary.incompletePhaseCount > 0) {
    const namedPhases = summary.incompletePhaseNames.slice(0, 3).join(", ");
    const suffix = summary.incompletePhaseNames.length > 3 ? ", and more" : "";
    fragments.push(`${pluralize(summary.incompletePhaseCount, "phase")} still incomplete${namedPhases ? ` (${namedPhases}${suffix})` : ""}`);
  }

  if (summary.pendingUnphasedTaskCount > 0) {
    fragments.push(`${pluralize(summary.pendingUnphasedTaskCount, "unphased task")} still pending`);
  }

  return `Cannot mark project complete while ${fragments.join(" and ")}.`;
};

export const getPhaseCompletionSummary = async (
  prisma: PrismaExecutor,
  phaseId: string
): Promise<PhaseCompletionSummary | null> => {
  const phase = await prisma.projectPhase.findUnique({
    where: { id: phaseId, deletedAt: null },
    select: {
      id: true,
      projectId: true,
      name: true,
      status: true,
      actualEndDate: true,
      tasks: {
        where: { deletedAt: null },
        select: {
          status: true,
          taskType: true,
          isCompleted: true
        }
      },
      supplies: {
        where: { deletedAt: null },
        select: {
          isProcured: true
        }
      }
    }
  });

  if (!phase) {
    return null;
  }

  return {
    ...summarizePhase(phase),
    projectId: phase.projectId
  };
};

export const getProjectCompletionSummary = async (
  prisma: PrismaExecutor,
  projectId: string
): Promise<ProjectCompletionSummary | null> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      name: true,
      phases: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          status: true,
          actualEndDate: true,
          tasks: {
            where: { deletedAt: null },
            select: {
              status: true,
              taskType: true,
              isCompleted: true
            }
          },
          supplies: {
            where: { deletedAt: null },
            select: {
              isProcured: true
            }
          }
        }
      },
      tasks: {
        where: { phaseId: null, deletedAt: null },
        select: {
          status: true,
          taskType: true,
          isCompleted: true
        }
      }
    }
  });

  if (!project) {
    return null;
  }

  const phaseSummaries = project.phases.map((phase) => ({
    rawStatus: phase.status,
    summary: summarizePhase(phase)
  }));
  const incompletePhaseNames = phaseSummaries
    .filter((phase) => !phase.summary.canComplete && !isClosedPhaseStatus(phase.rawStatus))
    .map((phase) => phase.summary.phaseName);
  const pendingUnphasedTaskCount = project.tasks.filter((task) => !isTaskCompleted(task)).length;

  return {
    projectId: project.id,
    projectName: project.name,
    incompletePhaseCount: incompletePhaseNames.length,
    incompletePhaseNames,
    pendingUnphasedTaskCount,
    trackedItemCount: project.phases.length + project.tasks.length,
    canComplete: incompletePhaseNames.length === 0 && pendingUnphasedTaskCount === 0
  };
};

export const syncProjectDerivedStatuses = async (
  prisma: PrismaExecutor,
  projectId: string,
  now = new Date()
): Promise<ProjectStatusSyncResult | null> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      status: true,
      actualEndDate: true,
      phases: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          status: true,
          actualEndDate: true,
          tasks: {
            where: { deletedAt: null },
            select: {
              status: true,
              taskType: true,
              isCompleted: true
            }
          },
          supplies: {
            where: { deletedAt: null },
            select: {
              isProcured: true
            }
          }
        }
      },
      tasks: {
        where: { phaseId: null, deletedAt: null },
        select: {
          status: true,
          taskType: true,
          isCompleted: true
        }
      }
    }
  });

  if (!project) {
    return null;
  }

  const effectivePhaseStatuses: Array<{ phaseId: string; status: string }> = [];

  for (const phase of project.phases) {
    const summary = summarizePhase(phase);
    let nextStatus = phase.status;

    if (phase.status !== "skipped") {
      if (summary.trackedItemCount > 0 && summary.canComplete) {
        nextStatus = "completed";
      } else if (phase.status === "completed" && !summary.canComplete) {
        nextStatus = deriveReopenedPhaseStatus(phase);
      }
    }

    effectivePhaseStatuses.push({ phaseId: phase.id, status: nextStatus });

    const shouldSetActualEndDate = nextStatus === "completed" && phase.actualEndDate === null;
    const shouldClearActualEndDate = nextStatus !== "completed" && phase.actualEndDate !== null;

    if (nextStatus !== phase.status || shouldSetActualEndDate || shouldClearActualEndDate) {
      await prisma.projectPhase.update({
        where: { id: phase.id },
        data: {
          status: nextStatus,
          actualEndDate: nextStatus === "completed" ? (phase.actualEndDate ?? now) : null
        }
      });
    }
  }

  const pendingUnphasedTaskCount = project.tasks.filter((task) => !isTaskCompleted(task)).length;
  const incompletePhaseCount = effectivePhaseStatuses.filter((phase) => !isClosedPhaseStatus(phase.status)).length;
  const hasTrackedWork = effectivePhaseStatuses.length > 0 || project.tasks.length > 0;
  const canCompleteProject = incompletePhaseCount === 0 && pendingUnphasedTaskCount === 0;
  let nextProjectStatus = project.status;

  if (project.status !== "cancelled") {
    if (hasTrackedWork && canCompleteProject) {
      nextProjectStatus = "completed";
    } else if (project.status === "completed" && !canCompleteProject) {
      nextProjectStatus = "active";
    }
  }

  const shouldSetProjectActualEndDate = nextProjectStatus === "completed" && project.actualEndDate === null;
  const shouldClearProjectActualEndDate = nextProjectStatus !== "completed" && project.actualEndDate !== null;

  if (nextProjectStatus !== project.status || shouldSetProjectActualEndDate || shouldClearProjectActualEndDate) {
    await prisma.project.update({
      where: { id: project.id },
      data: {
        status: nextProjectStatus,
        actualEndDate: nextProjectStatus === "completed" ? (project.actualEndDate ?? now) : null
      }
    });
  }

  return {
    projectId: project.id,
    projectStatus: nextProjectStatus,
    phaseStatuses: effectivePhaseStatuses
  };
};