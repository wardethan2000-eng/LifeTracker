import type { JSX } from "react";
import { ApiError, getCanvas, getEntries, getMe } from "../../../../lib/api";
import { CanvasPageClient } from "./canvas-page-client";
import Link from "next/link";

type CanvasPageProps = {
  params: Promise<{ canvasId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CanvasPage({ params, searchParams }: CanvasPageProps): Promise<JSX.Element> {
  const { canvasId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((h: { id: string }) => h.id === householdId) ?? me.households[0];
    if (!household) return <p>No household found.</p>;

    const [canvas, notesResponse] = await Promise.all([
      getCanvas(household.id, canvasId),
      getEntries(household.id, { entityType: "notebook", entityId: household.id, limit: 200 }),
    ]);

    return (
      <div>
        <div style={{ marginBottom: 12 }}>
          <Link href={`/notes?householdId=${household.id}`} className="button button--ghost button--small">
            ← Back to Notes
          </Link>
        </div>
        <CanvasPageClient
          householdId={household.id}
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
