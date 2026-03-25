import type { JSX } from "react";
import { ApiError, getEntry, getMe, getNoteFolders } from "../../../../lib/api";
import { NoteEditor } from "../../../../components/note-editor";

type NoteDetailPageProps = {
  params: Promise<{ entryId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NoteDetailPage({
  params,
  searchParams,
}: NoteDetailPageProps): Promise<JSX.Element> {
  const { entryId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdIdParam =
    typeof query.householdId === "string" ? query.householdId : undefined;

  try {
    const me = await getMe();
    const household = householdIdParam
      ? (me.households.find((h: { id: string }) => h.id === householdIdParam) ??
          me.households[0])
      : me.households[0];

    if (!household) {
      return (
        <div className="page-body">
          <p className="note">No household found. Create or join one to continue.</p>
        </div>
      );
    }

    const [entry, folders] = await Promise.all([
      getEntry(household.id, entryId),
      getNoteFolders(household.id),
    ]);

    return (
      <div className="page-body page-body--full">
        <NoteEditor
          householdId={household.id}
          entry={entry}
          folderOptions={folders}
        />
      </div>
    );
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        return (
          <div className="page-body">
            <p className="note">Sign in to view your notes.</p>
          </div>
        );
      }
      if (error.status === 404) {
        return (
          <div className="page-body">
            <p className="note">Note not found.</p>
          </div>
        );
      }
    }
    throw error;
  }
}
