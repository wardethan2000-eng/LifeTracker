import { Suspense, type JSX } from "react";
import { ApiError, getMe, getNoteTemplates } from "../../../../lib/api";
import { NoteTemplateManager } from "../../../../components/note-template-manager";
import { PageHeader } from "../../../../components/page-header";

async function TemplatesContent({ householdId }: { householdId: string }): Promise<JSX.Element> {
  try {
    const templates = await getNoteTemplates(householdId);

    return (
      <>
        <PageHeader
          title="Note Templates"
          subtitle="Reusable note structures for common workflows. Built-in templates are read-only."
        />

        <div className="page-body">
          <NoteTemplateManager
            householdId={householdId}
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

export default async function NoteTemplatesPage(): Promise<JSX.Element> {
  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return (
      <div className="page-body">
        <p className="note">No household found. Create or join one to continue.</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<><PageHeader title="Note Templates" subtitle="Reusable note structures for common workflows. Built-in templates are read-only." /><div className="page-body"><div className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1,2,3].map((i) => <div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />)}</div></div></div></>}>
      <TemplatesContent householdId={household.id} />
    </Suspense>
  );
}
