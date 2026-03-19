import type { JSX } from "react";
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

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    const [hobby, assets, inventoryCatalog, projects] = await Promise.all([
      getHobbyDetail(household.id, hobbyId),
      getHouseholdAssets(household.id),
      getHouseholdInventory(household.id, { limit: 100 }),
      getHouseholdProjects(household.id),
    ]);

    return (
      <HobbyLinksManager
        householdId={household.id}
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