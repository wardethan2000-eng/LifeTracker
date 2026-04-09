import type { JSX } from "react";
import { Suspense } from "react";
import { ApiError, getCanvasesByEntityWithGeometry, getMe } from "../../../../../lib/api";
import { EntityCanvasList } from "../../../../../components/entity-canvas-list";

type IdeaCanvasPageProps = {
  params: Promise<{ ideaId: string }>;
};

export default async function IdeaCanvasPage({ params }: IdeaCanvasPageProps): Promise<JSX.Element> {
  const { ideaId } = await params;
  const me = await getMe();
  const household = me.households[0];
  if (!household) return <p>No household found.</p>;

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section>}>
      <CanvasContent householdId={household.id} ideaId={ideaId} />
    </Suspense>
  );
}

async function CanvasContent({ householdId, ideaId }: { householdId: string; ideaId: string }): Promise<JSX.Element> {
  try {
    const canvases = await getCanvasesByEntityWithGeometry(householdId, "idea", ideaId);

    return (
      <section id="idea-canvas" style={{ padding: "16px 0" }}>
        <EntityCanvasList
          householdId={householdId}
          entityType="idea"
          entityId={ideaId}
          initialCanvases={canvases}
        />
      </section>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load canvases: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}
