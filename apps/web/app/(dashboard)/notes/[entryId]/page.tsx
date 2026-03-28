import { Suspense, type JSX } from "react";
import { ApiError, getEntry, getMe, getNoteFolders } from "../../../../lib/api";
import { NoteEditor } from "../../../../components/note-editor";

type NoteDetailPageProps = {
  params: Promise<{ entryId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function NoteDetailContent({ householdId, entryId }: { householdId: string; entryId: string }): Promise<JSX.Element> {
  try {
    const [entry, folders] = await Promise.all([
      getEntry(householdId, entryId),
      getNoteFolders(householdId),
    ]);

    return (
      <div className="page-body page-body--full">
        <NoteEditor
          householdId={householdId}
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

export default async function NoteDetailPage({
  params,
  searchParams,
}: NoteDetailPageProps): Promise<JSX.Element> {
  const { entryId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdIdParam =
    typeof query.householdId === "string" ? query.householdId : undefined;

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

  return (
    <Suspense fallback={<div className="page-body"><div className="panel"><div className="panel__body--padded"><p className="note">Loading note…</p></div></div></div>}>
      <NoteDetailContent householdId={household.id} entryId={entryId} />
    </Suspense>
  );
}
