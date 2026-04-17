import type { JSX } from "react";
import { ApiError, getMe } from "../../../../../lib/api";
import { EntityNotesWorkspace } from "../../../../../components/entity-notes-workspace";

type HobbySectionPageProps = {
  params: Promise<{ hobbyId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HobbyEntriesPage({ params, searchParams }: HobbySectionPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;
  void searchParams;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    return (
      <EntityNotesWorkspace
        householdId={household.id}
        entityType="hobby"
        entityId={hobbyId}
        title="Hobby notes"
        subtitle="Store journal entries, practice observations, reminders, and reference notes for this hobby."
        backToHref={`/hobbies/${hobbyId}/entries`}
      />
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load entries: {error.message}</p></div></div>;
    }
    throw error;
  }
}
