import type { JSX } from "react";
import { Suspense } from "react";
import { ApiError, getMe, fetchProjectTimelineData } from "../../../../../lib/api";
import { ProjectGanttTimeline } from "../../../../../components/project-gantt-timeline";

type ProjectTimelinePageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectTimelinePage({ params, searchParams }: ProjectTimelinePageProps): Promise<JSX.Element> {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;

  const me = await getMe();
  const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

  if (!household) {
    return <p>No household found.</p>;
  }

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading timeline…</div></div>}>
      <TimelineContent householdId={household.id} projectId={projectId} />
    </Suspense>
  );
}

async function TimelineContent({ householdId, projectId }: { householdId: string; projectId: string }): Promise<JSX.Element> {
  try {
    const timelineData = await fetchProjectTimelineData(householdId, projectId);

    return (
      <section id="project-timeline">
        <ProjectGanttTimeline
          data={timelineData}
          householdId={householdId}
          projectId={projectId}
        />
      </section>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load timeline: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}
