import { Suspense, type JSX } from "react";
import { ApiError, getCanvas, getEntries, getMe } from "../../../../lib/api";
import { CanvasPageClient } from "./canvas-page-client";
import Link from "next/link";

type CanvasPageProps = {
  params: Promise<{ canvasId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function CanvasContent({ householdId, canvasId }: { householdId: string; canvasId: string }): Promise<JSX.Element> {
  try {
    const [canvas, notesResponse] = await Promise.all([
      getCanvas(householdId, canvasId),
      getEntries(householdId, { entityType: "notebook", entityId: householdId, limit: 100 }),
    ]);

    return (
      <div>
        <div style={{ marginBottom: 12 }}>
          <Link href={`/notes?householdId=${householdId}`} className="button button--ghost button--small">
            ← Notes
          </Link>
        </div>
        <CanvasPageClient
          householdId={householdId}
          canvas={canvas}
          entries={notesResponse.items}
        />
      </div>
    );
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load canvas: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}

export default async function CanvasPage({ params, searchParams }: CanvasPageProps): Promise<JSX.Element> {
  const { canvasId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;

  const me = await getMe();
  const household = me.households.find((h: { id: string }) => h.id === householdId) ?? me.households[0];
  if (!household) return <p>No household found.</p>;

  return (
    <Suspense fallback={<div className="panel"><div className="panel__body--padded"><p className="note">Loading canvas…</p></div></div>}>
      <CanvasContent householdId={household.id} canvasId={canvasId} />
    </Suspense>
  );
}
