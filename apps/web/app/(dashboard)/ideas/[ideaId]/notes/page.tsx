import type { JSX } from "react";
import { ApiError, getMe } from "../../../../../lib/api";
import { EntityNotesWorkspace } from "../../../../../components/entity-notes-workspace";

type IdeaNotesPageProps = {
  params: Promise<{ ideaId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function IdeaNotesPage({ params, searchParams }: IdeaNotesPageProps): Promise<JSX.Element> {
  const { ideaId } = await params;
  void searchParams;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    return (
        <EntityNotesWorkspace
          householdId={household.id}
          entityType="idea"
          entityId={ideaId}
          backToHref={`/ideas/${ideaId}/notes?householdId=${household.id}`}
        />
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
