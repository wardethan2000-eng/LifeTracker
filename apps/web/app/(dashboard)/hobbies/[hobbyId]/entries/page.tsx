import type { JSX } from "react";
import { EntryTimeline } from "../../../../../components/entry-system";
import { ApiError, getMe } from "../../../../../lib/api";

type HobbySectionPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function HobbyEntriesPage({ params }: HobbySectionPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    return (
      <EntryTimeline
        householdId={household.id}
        entityType="hobby"
        entityId={hobbyId}
        title="Hobby Entries"
        quickAddLabel="Entry"
        entryHrefTemplate={`/hobbies/${hobbyId}/entries#entry-{entryId}`}
      />
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load entries: {error.message}</p></div></div>;
    }
    throw error;
  }
}