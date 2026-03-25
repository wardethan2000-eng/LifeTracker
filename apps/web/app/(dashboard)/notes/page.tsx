import type { JSX } from "react";
import { ApiError, getCanvases, getMe, getNoteFolders, getEntries, getNoteTemplates } from "../../../lib/api";
import { NotesHub } from "../../../components/notes-hub";

export default async function NotesPage(): Promise<JSX.Element> {
  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return (
        <div className="page-body">
          <p className="note">No household found. Create or join one to continue.</p>
        </div>
      );
    }

    const [folders, entries, templates, canvases] = await Promise.all([
      getNoteFolders(household.id),
      getEntries(household.id, { entityType: "notebook", entityId: household.id }),
      getNoteTemplates(household.id),
      getCanvases(household.id),
    ]);

    return (
      <>
        <header className="page-header">
          <div>
            <h1>Notes</h1>
            <p className="note">
              Capture, organize, and develop your thoughts across all areas of LifeKeeper.
            </p>
          </div>
        </header>

        <div className="page-body">
          <NotesHub
            householdId={household.id}
            initialFolders={folders}
            initialEntries={entries.items}
            templates={templates}
            canvases={canvases}
          />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return (
        <div className="page-body">
          <p className="note">Sign in to view your notes.</p>
        </div>
      );
    }
    throw error;
  }
}
