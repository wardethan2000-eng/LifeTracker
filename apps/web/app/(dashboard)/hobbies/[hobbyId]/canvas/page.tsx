import type { JSX } from "react";
import { ApiError, getCanvasesByEntityWithGeometry, getMe } from "../../../../../lib/api";
import { EntityCanvasList } from "../../../../../components/entity-canvas-list";

type HobbyCanvasPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function HobbyCanvasPage({ params }: HobbyCanvasPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    const canvases = await getCanvasesByEntityWithGeometry(household.id, "hobby", hobbyId);

    return (
      <section id="hobby-canvas" style={{ padding: "16px 0" }}>
        <EntityCanvasList
          householdId={household.id}
          entityType="hobby"
          entityId={hobbyId}
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
