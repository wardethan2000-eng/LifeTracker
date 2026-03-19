import type { JSX } from "react";
import { ApiError, getMe, getNoteTemplates } from "../../../../lib/api";
import { NoteTemplateManager } from "../../../../components/note-template-manager";

export default async function NoteTemplatesPage(): Promise<JSX.Element> {
  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return (
        <div className="page-body">
          <p className="note">No household found. Please create or join one first.</p>
        </div>
      );
    }

    const templates = await getNoteTemplates(household.id);

    return (
      <>
        <header className="page-header">
          <div>
            <h1>Note Templates</h1>
            <p className="note">
              Reusable note structures for common workflows. Built-in templates are read-only.
            </p>
          </div>
        </header>

        <div className="page-body">
          <NoteTemplateManager
            householdId={household.id}
            initialTemplates={templates}
          />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return (
        <div className="page-body">
          <p className="note">Please sign in to view templates.</p>
        </div>
      );
    }
    throw error;
  }
}
