import type { JSX } from "react";
import { ApiError, getMe } from "../../../../../lib/api";
import { EntityNotesWorkspace } from "../../../../../components/entity-notes-workspace";

type HobbyNotesPageProps = {
  params: Promise<{ hobbyId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HobbyNotesPage({ params, searchParams }: HobbyNotesPageProps): Promise<JSX.Element> {
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
        backToHref={`/hobbies/${hobbyId}/notes?householdId=${household.id}`}
      />
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load notes: {error.message}</p></div></div>;
    }
    throw error;
  }
}
