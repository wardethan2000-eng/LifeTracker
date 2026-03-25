import type { JSX } from "react";
import { ApiError, getMe, getNoteTemplates } from "../../../../lib/api";
import { NoteTemplateManager } from "../../../../components/note-template-manager";
import { PageHeader } from "../../../../components/page-header";

export default async function NoteTemplatesPage(): Promise<JSX.Element> {
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

    const templates = await getNoteTemplates(household.id);

    return (
      <>
        <PageHeader
          title="Note Templates"
          subtitle="Reusable note structures for common workflows. Built-in templates are read-only."
        />

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
          <p className="note">Sign in to view templates.</p>
        </div>
      );
    }
    throw error;
  }
}
