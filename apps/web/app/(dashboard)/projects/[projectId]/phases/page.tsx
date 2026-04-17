import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import { PhaseSplitPanel } from "../../../../../components/phase-split-panel";
import { ProjectGanttTimeline } from "../../../../../components/project-gantt-timeline";
import {
  ApiError,
  fetchProjectTimelineData,
  getHouseholdInventory,
  getHouseholdMembers,
  getHouseholdServiceProviders,
  getMe,
  getProjectDetail,
  getProjectPhaseDetails,
} from "../../../../../lib/api";

type ProjectPhasesPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const PhaseDetailsSkeleton = (): JSX.Element => (
  <div className="phase-split">
    <div className="phase-split__list">
      <div className="phase-split__list-header">
        <div className="skeleton-bar" style={{ width: 80, height: 20 }} />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="phase-list-item" style={{ pointerEvents: "none" }}>
          <div className="skeleton-bar" style={{ width: "70%", height: 16, marginBottom: 6 }} />
          <div className="skeleton-bar" style={{ width: "50%", height: 12 }} />
        </div>
      ))}
    </div>
    <div className="phase-split__detail">
      <div style={{ display: "grid", gap: 16, padding: 24 }}>
        <div className="skeleton-bar" style={{ width: 200, height: 24 }} />
        <div className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 10 }} />
        <div className="skeleton-bar" style={{ width: "100%", height: 88, borderRadius: 12 }} />
        <div className="skeleton-bar" style={{ width: "100%", height: 88, borderRadius: 12 }} />
      </div>
    </div>
  </div>
);

const ScheduleSkeleton = (): JSX.Element => (
  <section className="panel" aria-hidden="true">
    <div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />
      ))}
    </div>
  </section>
);

export default async function ProjectPhasesPage({ params, searchParams }: ProjectPhasesPageProps): Promise<JSX.Element> {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;
  const focusedPhaseId = typeof query.focusPhaseId === "string" ? query.focusPhaseId : undefined;
  const view = query.view === "schedule" ? "schedule" : "board";

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return <p>No household found.</p>;
    }

    const project = await getProjectDetail(household.id, projectId);
    const buildPlanHref = (targetView: "board" | "schedule"): string => {
      const params = new URLSearchParams({ householdId: household.id });
      if (focusedPhaseId) {
        params.set("focusPhaseId", focusedPhaseId);
      }
      if (targetView === "schedule") {
        params.set("view", "schedule");
      }
      return `/projects/${project.id}/phases?${params.toString()}`;
    };

    return (
      <section id="project-phases">
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__body--padded" style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 6, maxWidth: 720 }}>
                <h2 style={{ margin: 0 }}>Plan workspace</h2>
                <p className="data-table__secondary" style={{ margin: 0 }}>
                  Manage phases, tasks, milestones, materials, and schedule from one planning surface instead of splitting planning across separate tabs.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link href={buildPlanHref("board")} className={`button button--sm${view === "board" ? "" : " button--ghost"}`}>
                  Plan board
                </Link>
                <Link href={buildPlanHref("schedule")} className={`button button--sm${view === "schedule" ? "" : " button--ghost"}`}>
                  Schedule
                </Link>
              </div>
            </div>
          </div>
        </div>

        <Suspense fallback={view === "schedule" ? <ScheduleSkeleton /> : <PhaseDetailsSkeleton />}>
          {view === "schedule" ? (
            <ProjectScheduleAsync householdId={household.id} projectId={project.id} />
          ) : (
            <PhaseSplitPanelAsync
              householdId={household.id}
              projectId={project.id}
              project={project}
              {...(focusedPhaseId ? { initialPhaseId: focusedPhaseId } : {})}
            />
          )}
        </Suspense>
      </section>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load plan workspace: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}

async function PhaseSplitPanelAsync({
  householdId,
  projectId,
  project,
  initialPhaseId,
}: {
  householdId: string;
  projectId: string;
  project: Awaited<ReturnType<typeof getProjectDetail>>;
  initialPhaseId?: string;
}): Promise<JSX.Element> {
  const [phaseDetails, householdMembers, serviceProviders, householdInventory] = await Promise.all([
    getProjectPhaseDetails(householdId, projectId),
    getHouseholdMembers(householdId),
    getHouseholdServiceProviders(householdId),
    getHouseholdInventory(householdId, { limit: 100 }),
  ]);

  const unphasedTasks = project.tasks.filter((task) => !task.phaseId);

  return (
    <PhaseSplitPanel
      householdId={householdId}
      projectId={projectId}
      phases={project.phases}
      phaseDetails={phaseDetails}
      allTasks={project.tasks}
      householdMembers={householdMembers}
      serviceProviders={serviceProviders}
      budgetCategories={project.budgetCategories}
      inventoryItems={householdInventory.items}
      unphasedTasks={unphasedTasks}
      {...(initialPhaseId ? { initialPhaseId } : {})}
    />
  );
}

async function ProjectScheduleAsync({ householdId, projectId }: { householdId: string; projectId: string }): Promise<JSX.Element> {
  const timelineData = await fetchProjectTimelineData(householdId, projectId);

  return (
    <section id="project-schedule">
      <ProjectGanttTimeline
        data={timelineData}
        householdId={householdId}
        projectId={projectId}
      />
    </section>
  );
}
