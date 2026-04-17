import Link from "next/link";
import type {
  ProjectPhaseProgress,
} from "@aegis/types";
import type { JSX } from "react";
import { Suspense } from "react";
import {
  ApiError,
  getMe,
  getProjectDetail,
  getEntries,
  getCanvasesByEntityWithGeometry,
  getSourceIdea,
  getOverviewPins,
} from "../../../../lib/api";
import { IdeaProvenanceBar } from "../../../../components/idea-provenance-bar";
import { PinnedOverviewSection } from "../../../../components/pinned-overview-section";
import { ProjectDashboard } from "../../../../components/project-dashboard";
import { formatCurrency, formatDate } from "../../../../lib/formatters";

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

// ── Deferred overview content ──────────────────────────────
async function ProjectOverviewContent({ householdId, projectId, qs }: { householdId: string; projectId: string; qs: string }): Promise<JSX.Element> {
  try {
    const [project, entriesResult, sourceIdea, canvases, pinnedResult, overviewPins] = await Promise.all([
      getProjectDetail(householdId, projectId),
      getEntries(householdId, {
        entityType: "project",
        entityId: projectId,
        limit: 5,
        sortBy: "entryDate",
        excludeFlags: ["archived"],
        tags: undefined,
      }).catch(() => ({ items: [], nextCursor: null })),
      getSourceIdea(householdId, "project", projectId).catch(() => null),
      getCanvasesByEntityWithGeometry(householdId, "project", projectId).catch(() => []),
      getEntries(householdId, { entityType: "project", entityId: projectId, flags: ["pinned"], limit: 10 }).catch(() => ({ items: [], nextCursor: null })),
      getOverviewPins("project", projectId).catch(() => []),
    ]);

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

    // Supply counts roll up from project phases in the current detail payload.
    const supplyTotalItems = project.phases.reduce((sum, phase) => sum + phase.supplyCount, 0);
    const supplyNeededItems = project.phases.reduce(
      (sum, phase) => sum + Math.max(phase.supplyCount - phase.procuredSupplyCount, 0),
      0,
    );

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
    const nextTask = upcomingTasks[0] ?? null;

    // Top linked assets
    const topAssets = project.assets.slice(0, 5).map((a) => ({
      id: a.asset?.id ?? a.assetId,
      name: a.asset?.name ?? "Unknown",
      relationship: assetRelationshipLabels[a.relationship ?? "target"] ?? a.relationship ?? "Linked",
    }));

    // Recent log entries
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
    const canvasSummaries = canvases.map((c) => ({ id: c.id, name: c.name, canvasMode: c.canvasMode, nodeCount: c.nodes.length, edgeCount: c.edges.length, updatedAt: c.updatedAt }));

    return (
      <>
        {sourceIdea && (
          <IdeaProvenanceBar ideaId={sourceIdea.id} ideaTitle={sourceIdea.title} />
        )}
        <PinnedOverviewSection
          householdId={householdId}
          entityType="project"
          entityId={projectId}
          entries={pinnedResult.items}
          overviewPins={overviewPins}
        />
        <section className="panel">
          <div className="panel__body--padded project-overview-hero">
            <div className="project-overview-hero__summary">
              <div className="project-overview-hero__eyebrow">Project overview</div>
              <h2>{project.name}</h2>
              <p>
                {project.description?.trim().length
                  ? project.description
                  : "This workspace brings the next plan step, schedule pressure, budget, materials, and recent activity into one place."}
              </p>
            </div>
            <dl className="project-overview-hero__details">
              <div>
                <dt>Next focus</dt>
                <dd>{nextTask?.title ?? activePhase?.name ?? "Define the next task or phase"}</dd>
              </div>
              <div>
                <dt>Timing</dt>
                <dd>{formatDate(project.targetEndDate, "No target end date")}</dd>
              </div>
              <div>
                <dt>Budget</dt>
                <dd>{formatCurrency(project.budgetAmount, "No budget set")}</dd>
              </div>
              <div>
                <dt>Materials</dt>
                <dd>{supplyNeededItems > 0 ? `${supplyNeededItems} items still needed` : "No material blockers"}</dd>
              </div>
            </dl>
          </div>
        </section>
        <section className="stats-row">
          <div className="stat-card stat-card--accent">
            <span className="stat-card__label">Progress</span>
            <strong className="stat-card__value">{percentComplete}%</strong>
            <span className="stat-card__sub">{completedTaskCount} of {totalTaskCount} tasks completed</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Current plan</span>
            <strong className="stat-card__value">{activePhase?.name ?? "No active phase"}</strong>
            <span className="stat-card__sub">{completedPhaseCount} of {phaseCount} phases complete</span>
          </div>
          <div className="stat-card stat-card--warning">
            <span className="stat-card__label">Upcoming work</span>
            <strong className="stat-card__value">{upcomingTasks.length}</strong>
            <span className="stat-card__sub">{blockedTasks.length} blocked · {criticalPathTasks.length} critical path</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Connected work</span>
            <strong className="stat-card__value">{project.assets.length + (project.childProjects?.length ?? 0)}</strong>
            <span className="stat-card__sub">{project.assets.length} assets · {project.childProjects?.length ?? 0} sub-projects</span>
          </div>
        </section>
        <ProjectDashboard
          householdId={householdId}
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
          canvasThumbnails={canvases}
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

// ── Page ──────────────────────────────────────────────────
export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps): Promise<JSX.Element> {
  const [routeParams, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);
  const householdIdParam = typeof query.householdId === "string" ? query.householdId : undefined;

  const me = await getMe();
  const household = me.households.find((item) => item.id === householdIdParam) ?? me.households[0];

  if (!household) {
    return (
      <p>No household found. <Link href="/projects" className="text-link">← Projects</Link>.</p>
    );
  }

  const qs = `?householdId=${household.id}`;

  const overviewSkeleton = (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="stats-row" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stat-card">
            <div className="skeleton-bar" style={{ width: 90, height: 12 }} />
            <div className="skeleton-bar" style={{ width: 48, height: 28, marginTop: 8 }} />
            <div className="skeleton-bar" style={{ width: 110, height: 12, marginTop: 8 }} />
          </div>
        ))}
      </section>
      <section className="panel" aria-hidden="true">
        <div className="panel__header">
          <div className="skeleton-bar" style={{ width: 160, height: 18 }} />
        </div>
        <div className="panel__body--padded" style={{ display: "grid", gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-bar" style={{ width: "100%", height: 44, borderRadius: 6 }} />
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <Suspense fallback={overviewSkeleton}>
      <ProjectOverviewContent householdId={household.id} projectId={routeParams.projectId} qs={qs} />
    </Suspense>
  );
}
