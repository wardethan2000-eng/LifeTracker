import type { Prisma, ProjectAssetRelationship, ProjectStatus } from "@prisma/client";

type SnapshotAssetLink = {
  assetId: string;
  relationship: string;
  role: string | null;
  notes: string | null;
};

type SnapshotBudgetCategory = {
  name: string;
  budgetAmount: number | null;
  sortOrder: number | null;
  notes: string | null;
};

type SnapshotPhase = {
  templatePhaseId: string;
  name: string;
  description: string | null;
  status: string;
  sortOrder: number | null;
  budgetAmount: number | null;
  notes: string | null;
  startOffsetDays: number | null;
  targetOffsetDays: number | null;
};

type SnapshotTask = {
  templateTaskId: string;
  phaseTemplateId: string | null;
  title: string;
  description: string | null;
  taskType: string;
  assignedToId: string | null;
  sortOrder: number | null;
  estimatedCost: number | null;
  estimatedHours: number | null;
  dueOffsetDays: number | null;
  predecessorTemplateTaskIds: string[];
};

export type ProjectTemplateSnapshot = {
  project: {
    status: string;
    description: string | null;
    budgetAmount: number | null;
    notes: string | null;
    targetOffsetDays: number | null;
  };
  assetLinks: SnapshotAssetLink[];
  budgetCategories: SnapshotBudgetCategory[];
  phases: SnapshotPhase[];
  tasks: SnapshotTask[];
};

type SnapshotSourceProject = {
  status: string;
  description: string | null;
  startDate: Date | null;
  targetEndDate: Date | null;
  budgetAmount: number | null;
  notes: string | null;
  assets: Array<SnapshotAssetLink>;
  budgetCategories: Array<SnapshotBudgetCategory>;
  phases: Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    sortOrder: number | null;
    startDate: Date | null;
    targetEndDate: Date | null;
    budgetAmount: number | null;
    notes: string | null;
  }>;
  tasks: Array<{
    id: string;
    phaseId: string | null;
    title: string;
    description: string | null;
    taskType: string;
    assignedToId: string | null;
    dueDate: Date | null;
    estimatedCost: number | null;
    estimatedHours: number | null;
    sortOrder: number | null;
    predecessorLinks: Array<{ predecessorTaskId: string }>;
  }>;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toDayOffset = (anchorDate: Date | null, value: Date | null): number | null => {
  if (!anchorDate || !value) {
    return null;
  }

  return Math.round((value.getTime() - anchorDate.getTime()) / MS_PER_DAY);
};

const fromDayOffset = (anchorDate: Date | null, offsetDays: number | null): Date | null => {
  if (!anchorDate || offsetDays === null) {
    return null;
  }

  return new Date(anchorDate.getTime() + (offsetDays * MS_PER_DAY));
};

const normalizeProjectStatus = (status: string): string => {
  if (status === "completed" || status === "cancelled") {
    return "planning";
  }

  return status;
};

const normalizeTaskType = (taskType: string): string => taskType === "quick" ? "quick" : "full";

export const buildProjectTemplateSnapshot = (project: SnapshotSourceProject): ProjectTemplateSnapshot => {
  const phaseTemplateIdById = new Map<string, string>();
  const taskTemplateIdById = new Map<string, string>();

  for (const phase of project.phases) {
    phaseTemplateIdById.set(phase.id, `phase-${phase.id}`);
  }

  for (const task of project.tasks) {
    taskTemplateIdById.set(task.id, `task-${task.id}`);
  }

  return {
    project: {
      status: normalizeProjectStatus(project.status),
      description: project.description,
      budgetAmount: project.budgetAmount,
      notes: project.notes,
      targetOffsetDays: toDayOffset(project.startDate, project.targetEndDate)
    },
    assetLinks: project.assets.map((asset) => ({
      assetId: asset.assetId,
      relationship: asset.relationship,
      role: asset.role,
      notes: asset.notes
    })),
    budgetCategories: project.budgetCategories.map((category) => ({
      name: category.name,
      budgetAmount: category.budgetAmount,
      sortOrder: category.sortOrder,
      notes: category.notes
    })),
    phases: project.phases.map((phase) => ({
      templatePhaseId: phaseTemplateIdById.get(phase.id) ?? phase.id,
      name: phase.name,
      description: phase.description,
      status: phase.status === "skipped" ? "skipped" : "pending",
      sortOrder: phase.sortOrder,
      budgetAmount: phase.budgetAmount,
      notes: phase.notes,
      startOffsetDays: toDayOffset(project.startDate, phase.startDate),
      targetOffsetDays: toDayOffset(project.startDate, phase.targetEndDate)
    })),
    tasks: project.tasks.map((task) => ({
      templateTaskId: taskTemplateIdById.get(task.id) ?? task.id,
      phaseTemplateId: task.phaseId ? (phaseTemplateIdById.get(task.phaseId) ?? null) : null,
      title: task.title,
      description: task.description,
      taskType: normalizeTaskType(task.taskType),
      assignedToId: task.assignedToId,
      sortOrder: task.sortOrder,
      estimatedCost: task.estimatedCost,
      estimatedHours: task.estimatedHours,
      dueOffsetDays: toDayOffset(project.startDate, task.dueDate),
      predecessorTemplateTaskIds: task.predecessorLinks
        .map((dependency) => taskTemplateIdById.get(dependency.predecessorTaskId))
        .filter((value): value is string => Boolean(value))
    }))
  };
};

export const summarizeProjectTemplateSnapshot = (snapshot: ProjectTemplateSnapshot) => ({
  phaseCount: snapshot.phases.length,
  taskCount: snapshot.tasks.length,
  assetCount: snapshot.assetLinks.length
});

export const instantiateProjectFromTemplateSnapshot = async (
  tx: Prisma.TransactionClient,
  householdId: string,
  snapshot: ProjectTemplateSnapshot,
  input: {
    name: string;
    startDate?: string;
    targetEndDate?: string;
    parentProjectId?: string | null;
    depth?: number;
  }
) => {
  const startDate = input.startDate ? new Date(input.startDate) : null;
  const targetEndDate = input.targetEndDate
    ? new Date(input.targetEndDate)
    : fromDayOffset(startDate, snapshot.project.targetOffsetDays);

  const project = await tx.project.create({
    data: {
      householdId,
      name: input.name,
      description: snapshot.project.description,
      status: snapshot.project.status as ProjectStatus,
      startDate,
      targetEndDate,
      budgetAmount: snapshot.project.budgetAmount,
      notes: snapshot.project.notes,
      parentProjectId: input.parentProjectId ?? null,
      depth: input.depth ?? 0
    }
  });

  for (const assetLink of snapshot.assetLinks) {
    await tx.projectAsset.create({
      data: {
        projectId: project.id,
        assetId: assetLink.assetId,
        relationship: assetLink.relationship as ProjectAssetRelationship,
        role: assetLink.role,
        notes: assetLink.notes
      }
    });
  }

  for (const category of snapshot.budgetCategories) {
    await tx.projectBudgetCategory.create({
      data: {
        projectId: project.id,
        name: category.name,
        budgetAmount: category.budgetAmount,
        sortOrder: category.sortOrder,
        notes: category.notes
      }
    });
  }

  const phaseIdByTemplateId = new Map<string, string>();

  for (const phase of snapshot.phases) {
    const createdPhase = await tx.projectPhase.create({
      data: {
        projectId: project.id,
        name: phase.name,
        description: phase.description,
        status: phase.status,
        sortOrder: phase.sortOrder,
        startDate: fromDayOffset(startDate, phase.startOffsetDays),
        targetEndDate: fromDayOffset(startDate, phase.targetOffsetDays),
        budgetAmount: phase.budgetAmount,
        notes: phase.notes
      }
    });

    phaseIdByTemplateId.set(phase.templatePhaseId, createdPhase.id);
  }

  const taskIdByTemplateId = new Map<string, string>();

  for (const task of snapshot.tasks) {
    const createdTask = await tx.projectTask.create({
      data: {
        projectId: project.id,
        phaseId: task.phaseTemplateId ? (phaseIdByTemplateId.get(task.phaseTemplateId) ?? null) : null,
        title: task.title,
        description: task.taskType === "quick" ? null : task.description,
        status: task.taskType === "quick" ? "pending" : "pending",
        taskType: task.taskType,
        isCompleted: false,
        assignedToId: task.taskType === "quick" ? null : task.assignedToId,
        dueDate: fromDayOffset(startDate, task.dueOffsetDays),
        estimatedCost: task.taskType === "quick" ? null : task.estimatedCost,
        actualCost: null,
        estimatedHours: task.taskType === "quick" ? null : task.estimatedHours,
        actualHours: null,
        sortOrder: task.sortOrder,
        scheduleId: null,
        completedAt: null
      }
    });

    taskIdByTemplateId.set(task.templateTaskId, createdTask.id);
  }

  for (const task of snapshot.tasks) {
    const successorTaskId = taskIdByTemplateId.get(task.templateTaskId);

    if (!successorTaskId) {
      continue;
    }

    for (const predecessorTemplateTaskId of task.predecessorTemplateTaskIds) {
      const predecessorTaskId = taskIdByTemplateId.get(predecessorTemplateTaskId);

      if (!predecessorTaskId) {
        continue;
      }

      await tx.projectTaskDependency.create({
        data: {
          predecessorTaskId,
          successorTaskId
        }
      });
    }
  }

  return project;
};