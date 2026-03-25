import type { JSX } from "react";
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

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return <p>No household found.</p>;
    }

    const project = await getProjectDetail(household.id, projectId);

    // Build queries for the project itself and each of its phases so all
    // project-scoped notes appear together in the unified log.
    const queries = [
      { entityType: "project" as const, entityId: projectId },
      ...project.phases.map((phase) => ({
        entityType: "project_phase" as const,
        entityId: phase.id,
      })),
    ];

    const hasPhases = project.phases.length > 0;

    return (
      <section id="project-log">
        <EntryTipsSurface householdId={household.id} queries={queries} />
        {hasPhases && (
          <div className="callout callout--info" style={{ marginBottom: "var(--space-4)" }}>
            <strong>Phase notes</strong> — notes written directly on a phase are scoped to that phase and editable in the{" "}
            <a href={`/projects/${projectId}/phases`}>Plan tab</a>. They appear above in the recent activity feed.
          </div>
        )}
        <EntryTimeline
          householdId={household.id}
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
