import type { JSX } from "react";
import { Suspense } from "react";
import { HobbyCollectionTab } from "../../../../../components/hobby-collection-tab";
import { HobbyLinksManager } from "../../../../../components/hobby-links-manager";
import { HobbySeriesList } from "../../../../../components/hobby-series-list";
import {
  ApiError,
  getHobbyDetail,
  getHobbySeries,
  getHouseholdAssets,
  getHouseholdInventory,
  getHouseholdProjects,
  getMe,
  listHobbyCollectionItems,
} from "../../../../../lib/api";

type HobbySectionPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function HobbyCollectionPage({ params }: HobbySectionPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;
  const me = await getMe();
  const household = me.households[0];
  if (!household) return <p>No household found.</p>;

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section>}>
      <CollectionContent householdId={household.id} hobbyId={hobbyId} />
    </Suspense>
  );
}

async function CollectionContent({ householdId, hobbyId }: { householdId: string; hobbyId: string }): Promise<JSX.Element> {
  try {
    const [hobby, collectionItems, series, assets, inventoryCatalog, projects] = await Promise.all([
      getHobbyDetail(householdId, hobbyId),
      listHobbyCollectionItems(householdId, hobbyId, { limit: 100 }),
      getHobbySeries(householdId, hobbyId),
      getHouseholdAssets(householdId),
      getHouseholdInventory(householdId, { limit: 100 }),
      getHouseholdProjects(householdId),
    ]);

    return (
      <div style={{ display: "grid", gap: 24 }}>
        <section className="panel">
          <div className="panel__body--padded" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href="#hobby-collection-items" className="button button--ghost button--sm">Items</a>
            <a href="#hobby-links" className="button button--ghost button--sm">Links</a>
            <a href="#hobby-series" className="button button--ghost button--sm">Series</a>
          </div>
        </section>

        <section id="hobby-collection-items">
          <HobbyCollectionTab hobbyId={hobbyId} activityMode={hobby.activityMode} items={collectionItems.items} />
        </section>

        <section id="hobby-links">
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
        </section>

        <section id="hobby-series">
          <HobbySeriesList hobbyId={hobbyId} activityMode={hobby.activityMode} series={series} />
        </section>
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load collection: {error.message}</p></div></div>;
    }
    throw error;
  }
}
