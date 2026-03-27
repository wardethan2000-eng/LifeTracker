import type { JSX } from "react";
import { ApiError, getCanvasesByEntityWithGeometry, getMe } from "../../../../../lib/api";
import { EntityCanvasList } from "../../../../../components/entity-canvas-list";

type AssetCanvasPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetCanvasPage({ params }: AssetCanvasPageProps): Promise<JSX.Element> {
  const { assetId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    const canvases = await getCanvasesByEntityWithGeometry(household.id, "asset", assetId);

    return (
      <section id="asset-canvas" style={{ padding: "16px 0" }}>
        <EntityCanvasList
          householdId={household.id}
          entityType="asset"
          entityId={assetId}
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
