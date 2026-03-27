import type { JSX } from "react";
import { ApiError, getMe } from "../../../../../lib/api";
import { EntryTimeline } from "../../../../../components/entry-system";

type IdeaNotesPageProps = {
  params: Promise<{ ideaId: string }>;
};

export default async function IdeaNotesPage({ params }: IdeaNotesPageProps): Promise<JSX.Element> {
  const { ideaId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    return (
      <EntryTimeline
        householdId={household.id}
        entityType="idea"
        entityId={ideaId}
        title="Idea Notes"
        quickAddLabel="Note"
        entryHrefTemplate={`/ideas/${ideaId}/notes#entry-{entryId}`}
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
