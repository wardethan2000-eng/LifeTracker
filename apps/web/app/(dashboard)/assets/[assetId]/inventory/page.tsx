import type { JSX } from "react";
import { AssetInventoryLinks } from "../../../../../components/asset-inventory-links";
import { ApiError, getAssetInventoryLinks, getHouseholdInventory, getMe } from "../../../../../lib/api";

type AssetInventoryPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetInventoryPage({ params }: AssetInventoryPageProps): Promise<JSX.Element> {
  const { assetId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    const [links, inventoryCatalog] = await Promise.all([
      getAssetInventoryLinks(assetId),
      getHouseholdInventory(household.id, { limit: 100 }),
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
