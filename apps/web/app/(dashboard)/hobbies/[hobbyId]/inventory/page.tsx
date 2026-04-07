import type { JSX } from "react";
import { Suspense } from "react";
import { HobbyLinksManager } from "../../../../../components/hobby-links-manager";
import {
  ApiError,
  getHobbyDetail,
  getHouseholdAssets,
  getHouseholdInventory,
  getHouseholdProjects,
  getMe,
} from "../../../../../lib/api";

type HobbySectionPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function HobbyInventoryPage({ params }: HobbySectionPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;
  const me = await getMe();
  const household = me.households[0];
  if (!household) return <p>No household found.</p>;

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section>}>
      <InventoryContent householdId={household.id} hobbyId={hobbyId} />
    </Suspense>
  );
}

async function InventoryContent({ householdId, hobbyId }: { householdId: string; hobbyId: string }): Promise<JSX.Element> {
  try {
    const [hobby, assets, inventoryCatalog, projects] = await Promise.all([
      getHobbyDetail(householdId, hobbyId),
      getHouseholdAssets(householdId),
      getHouseholdInventory(householdId, { limit: 100 }),
      getHouseholdProjects(householdId),
    ]);

    return (
      <HobbyLinksManager
        householdId={householdId}
        hobbyId={hobbyId}
        initialAssetLinks={hobby.assetLinks}
        initialInventoryLinks={hobby.inventoryLinks}
        initialProjectLinks={hobby.projectLinks}
        initialCategories={hobby.inventoryCategories}
        availableAssets={assets.map((asset) => ({ id: asset.id, name: asset.name, category: asset.category }))}
        availableInventoryItems={inventoryCatalog.items.map((item) => ({ id: item.id, name: item.name, category: item.category, unit: item.unit, quantityOnHand: item.quantityOnHand }))}
        availableProjects={projects.map((project) => ({ id: project.id, name: project.name, status: project.status }))}
      />
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load inventory: {error.message}</p></div></div>;
    }
    throw error;
  }
}