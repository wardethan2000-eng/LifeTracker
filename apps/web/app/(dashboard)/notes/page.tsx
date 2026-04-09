import type { JSX } from "react";
import { Suspense } from "react";
import { ApiError, getCanvasesWithGeometry, getMe, getNoteFolders, getEntries, getNoteTemplates } from "../../../lib/api";
import { NotesHub } from "../../../components/notes-hub";
import { PageHeader } from "../../../components/page-header";

// ── Deferred notes content ─────────────────────────────────
async function NotesContent({ householdId, initialTab }: { householdId: string; initialTab: string }): Promise<JSX.Element> {
  try {
    const [folders, entries, templates, canvases] = await Promise.all([
      getNoteFolders(householdId),
      getEntries(householdId, { entityType: "notebook", entityId: householdId }),
      getNoteTemplates(householdId),
      getCanvasesWithGeometry(householdId),
    ]);

    return (
      <NotesHub
        householdId={householdId}
        initialFolders={folders}
        initialEntries={entries.items}
        templates={templates}
        canvases={canvases}
        initialTab={initialTab}
      />
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return <p className="note">Sign in to view your notes.</p>;
    }
    throw error;
  }
}

// ── Page ──────────────────────────────────────────────────
export default async function NotesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }): Promise<JSX.Element> {
  const [params, me] = await Promise.all([
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
    getMe(),
  ]);
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const initialTab = tabParam === "canvases" ? "canvases" : "notes";

  const household = me.households[0];

  if (!household) {
    return (
      <div className="page-body">
        <p className="note">No household found. Create or join one to continue.</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Notes"
        subtitle="Capture, organize, and develop your thoughts across all areas of LifeKeeper."
      />

      <div className="page-body">
        <Suspense fallback={
          <div className="panel" aria-hidden="true">
            <div className="panel__header">
              <div className="skeleton-bar" style={{ width: 120, height: 20 }} />
            </div>
            <div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />
              ))}
            </div>
          </div>
        }>
          <NotesContent householdId={household.id} initialTab={initialTab} />
        </Suspense>
      </div>
    </>
  );
}
