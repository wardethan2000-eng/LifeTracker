import type { JSX } from "react";
import { Suspense } from "react";
import { AssetInventoryLinks } from "../../../../../components/asset-inventory-links";
import { ApiError, getAssetInventoryLinks, getHouseholdInventory, getMe } from "../../../../../lib/api";

type AssetInventoryPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetInventoryPage({ params }: AssetInventoryPageProps): Promise<JSX.Element> {
  const { assetId } = await params;
  const me = await getMe();
  const household = me.households[0];
  if (!household) return <p>No household found.</p>;

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section>}>
      <InventoryContent assetId={assetId} householdId={household.id} />
    </Suspense>
  );
}

async function InventoryContent({ assetId, householdId }: { assetId: string; householdId: string }): Promise<JSX.Element> {
  try {
    const [links, inventoryCatalog] = await Promise.all([
      getAssetInventoryLinks(assetId),
      getHouseholdInventory(householdId, { limit: 100 }),
    ]);

    return (
      <AssetInventoryLinks
        assetId={assetId}
        initialLinks={links}
        availableItems={inventoryCatalog.items.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          unit: item.unit,
          quantityOnHand: item.quantityOnHand,
        }))}
      />
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load inventory: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}
