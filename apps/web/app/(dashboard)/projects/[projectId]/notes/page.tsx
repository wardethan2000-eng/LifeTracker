import type { JSX } from "react";
import { Suspense } from "react";
import { EntryTimeline, EntryTipsSurface } from "../../../../../components/entry-system";
import { ApiError, getMe, getProjectDetail } from "../../../../../lib/api";

type ProjectNotesPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectNotesPage({ params, searchParams }: ProjectNotesPageProps): Promise<JSX.Element> {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;

  const me = await getMe();
  const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

  if (!household) {
    return <p>No household found.</p>;
  }

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{display:"grid",gap:12}}>{[1,2,3].map((i)=>(<div key={i} className="skeleton-bar" style={{width:"100%",height:52,borderRadius:6}}/>))}</div></section>}>
      <NotesContent householdId={household.id} projectId={projectId} />
    </Suspense>
  );
}

async function NotesContent({ householdId, projectId }: { householdId: string; projectId: string }): Promise<JSX.Element> {
  try {
    const project = await getProjectDetail(householdId, projectId);

    const queries = [
      { entityType: "project" as const, entityId: projectId },
      ...project.phases.map((phase) => ({
        entityType: "project_phase" as const,
        entityId: phase.id,
      })),
    ];

    return (
      <section id="project-log">
        <EntryTipsSurface householdId={householdId} queries={queries} />
        <EntryTimeline
          householdId={householdId}
          entityType="project"
          entityId={projectId}
          title="Project Log"
          quickAddLabel="Note"
        />
      </section>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load project log: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}
