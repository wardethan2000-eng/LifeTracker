import Link from "next/link";
import type {
  ProjectPhaseProgress,
} from "@lifekeeper/types";
import type { JSX } from "react";
import {
  ApiError,
  getMe,
  getProjectDetail,
  getEntries,
  getCanvasesByEntity,
  getSourceIdea,
} from "../../../../lib/api";
import { IdeaProvenanceBar } from "../../../../components/idea-provenance-bar";
import { ProjectDashboard } from "../../../../components/project-dashboard";

type ProjectDetailPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const projectStatusLabels: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled"
};

const assetRelationshipLabels: Record<string, string> = {
  target: "Works on",
  produces: "Will create",
  consumes: "Consumes",
  supports: "Supports"
};

export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps): Promise<JSX.Element> {
  const routeParams = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return (
        <p>No household found. <Link href="/projects" className="text-link">← Projects</Link>.</p>
      );
    }

    const [project, entriesResult, sourceIdea, canvases] = await Promise.all([
      getProjectDetail(household.id, routeParams.projectId),
      getEntries(household.id, {
        entityType: "project",
        entityId: routeParams.projectId,
        limit: 5,
        sortBy: "entryDate",
        excludeFlags: ["archived"],
        tags: undefined,
      }).catch(() => ({ items: [], nextCursor: null })),
      getSourceIdea(household.id, "project", routeParams.projectId).catch(() => null),
      getCanvasesByEntity(household.id, "project", routeParams.projectId).catch(() => []),
    ]);

    const qs = `?householdId=${household.id}`;

    const quickTodos = project.tasks.filter((task) => task.taskType === "quick");
    const totalSpent = project.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const completedQuickTodoCount = quickTodos.filter((task) => task.isCompleted).length;
    const fullTasks = project.tasks.filter((task) => task.taskType !== "quick");
    const remainingEstimatedHours = fullTasks
      .filter((task) => task.status !== "completed" && task.status !== "skipped")
      .reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0);
    const blockedTasks = fullTasks.filter((task) => task.isBlocked);
    const criticalPathTasks = fullTasks.filter((task) => task.isCriticalPath);
    const unphasedTasks = fullTasks.filter((task) => task.phaseId === null);
    const completedFullTaskCount = fullTasks.filter((task) => task.status === "completed").length;
    const completedTaskCount = completedQuickTodoCount + completedFullTaskCount;
    const completedPhaseCount = project.phases.filter((phase) => phase.status === "completed").length;
    const phaseCount = project.phases.length;
    const totalTaskCount = project.tasks.length;
    const remainingTaskCount = totalTaskCount - completedTaskCount;
    const percentComplete = totalTaskCount === 0 ? 0 : Math.round((completedTaskCount / totalTaskCount) * 100);
    const activePhase = project.phases.find((phase) => phase.status === "in_progress");

    const phaseProgress: ProjectPhaseProgress[] = project.phases.map((phase) => ({
      name: phase.name,
      status: phase.status,
      taskCount: phase.taskCount,
      completedTaskCount: phase.completedTaskCount
    }));

    if (unphasedTasks.length > 0) {
      phaseProgress.push({
        name: "Unphased",
        status: "in_progress",
        taskCount: unphasedTasks.length,
        completedTaskCount: unphasedTasks.filter((task) => task.status === "completed").length
      });
    }

    // Supply counts from inventory
    const supplyTotalItems = project.supplies?.length ?? 0;
    const supplyNeededItems = project.supplies?.filter((s) => s.status === "needed").length ?? 0;

    // Upcoming tasks (not completed, sorted by due date)
    const upcomingTasks = fullTasks
      .filter((task) => task.status !== "completed" && task.status !== "skipped")
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      })
      .slice(0, 5)
      .map((task) => ({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate ?? null,
        status: task.status,
      }));

    // Top linked assets
    const topAssets = project.assets.slice(0, 5).map((a) => ({
      id: a.asset?.id ?? a.assetId,
      name: a.asset?.name ?? "Unknown",
      relationship: assetRelationshipLabels[a.relationship ?? "target"] ?? a.relationship ?? "Linked",
    }));

    // Recent journal entries
    const recentEntries = entriesResult.items
      .filter((e) => !(e.tags ?? []).includes("dashboard_notepad"))
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        title: e.title ?? "",
        entryDate: e.entryDate,
      }));

    const rawNote = entriesResult.items.find((e) => !(e.tags ?? []).includes("dashboard_notepad")) ?? null;
    const recentNote = rawNote ? { id: rawNote.id, title: rawNote.title ?? null, body: rawNote.body, bodyFormat: rawNote.bodyFormat, entryDate: rawNote.entryDate } : null;
    const canvasSummaries = canvases.map((c) => ({ id: c.id, name: c.name, canvasMode: c.canvasMode, nodeCount: c.nodeCount, edgeCount: c.edgeCount, updatedAt: c.updatedAt }));

    return (
      <>
        {sourceIdea && (
          <IdeaProvenanceBar ideaId={sourceIdea.id} ideaTitle={sourceIdea.title} />
        )}
        <ProjectDashboard
        householdId={household.id}
        projectId={project.id}
        qs={qs}
        status={project.status}
        statusLabel={projectStatusLabels[project.status] ?? project.status}
        percentComplete={percentComplete}
        remainingTaskCount={remainingTaskCount}
        totalTaskCount={totalTaskCount}
        completedTaskCount={completedTaskCount}
        blockedTasks={blockedTasks.length}
        criticalPathTasks={criticalPathTasks.length}
        completedPhaseCount={completedPhaseCount}
        phaseCount={phaseCount}
        activePhaseLabel={activePhase?.name ?? null}
        budgetAmount={project.budgetAmount ?? null}
        totalSpent={totalSpent}
        remainingEstimatedHours={remainingEstimatedHours}
        supplyTotalItems={supplyTotalItems}
        supplyNeededItems={supplyNeededItems}
        linkedAssetCount={project.assets.length}
        topAssets={topAssets}
        subProjectCount={project.childProjects?.length ?? 0}
        recentEntries={recentEntries}
        upcomingTasks={upcomingTasks}
        phaseProgress={phaseProgress}
        recentNote={recentNote}
        canvases={canvasSummaries}
      />
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load project: {error.message}</p>
          </div>
        </div>
      );
    }

    throw error;
  }
}
