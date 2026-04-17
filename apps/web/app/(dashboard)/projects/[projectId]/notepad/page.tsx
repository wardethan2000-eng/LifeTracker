import type { JSX } from "react";
import { ApiError, getMe } from "../../../../../lib/api";
import { EntityNotesWorkspace } from "../../../../../components/entity-notes-workspace";

type ProjectNotepadPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectNotepadPage({ params, searchParams }: ProjectNotepadPageProps): Promise<JSX.Element> {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((h) => h.id === householdId) ?? me.households[0];

    if (!household) {
      return <p>No household found.</p>;
    }

    return (
      <section id="project-notepad" style={{ padding: "16px 0" }}>
        <EntityNotesWorkspace
          householdId={household.id}
          entityType="project"
          entityId={projectId}
          backToHref={`/projects/${projectId}/notepad?householdId=${household.id}`}
        />
      </section>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load notes: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}
