import type { JSX } from "react";
import { ApiError, getCanvasesByEntityWithGeometry, getMe } from "../../../../../lib/api";
import { EntityCanvasList } from "../../../../../components/entity-canvas-list";

type IdeaCanvasPageProps = {
  params: Promise<{ ideaId: string }>;
};

export default async function IdeaCanvasPage({ params }: IdeaCanvasPageProps): Promise<JSX.Element> {
  const { ideaId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    const canvases = await getCanvasesByEntityWithGeometry(household.id, "idea", ideaId);

    return (
      <section id="idea-canvas" style={{ padding: "16px 0" }}>
        <EntityCanvasList
          householdId={household.id}
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
