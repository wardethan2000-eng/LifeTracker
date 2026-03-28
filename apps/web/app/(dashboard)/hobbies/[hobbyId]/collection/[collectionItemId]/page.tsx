import type { JSX } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { HobbyCollectionItemDetailSurface } from "../../../../../../components/hobby-collection-item-detail";
import { ApiError, getHobbyCollectionItem, getHobbyDetail, getHobbyMetrics, getMe } from "../../../../../../lib/api";

type HobbyCollectionDetailPageProps = {
  params: Promise<{ hobbyId: string; collectionItemId: string }>;
};

export default async function HobbyCollectionDetailPage({ params }: HobbyCollectionDetailPageProps): Promise<JSX.Element> {
  const { hobbyId, collectionItemId } = await params;
  const me = await getMe();
  const household = me.households[0];
  if (!household) {
    return <div className="page-body"><p>No household found.</p></div>;
  }

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading…</div></div>}>
      <CollectionItemContent householdId={household.id} hobbyId={hobbyId} collectionItemId={collectionItemId} />
    </Suspense>
  );
}

async function CollectionItemContent({ householdId, hobbyId, collectionItemId }: { householdId: string; hobbyId: string; collectionItemId: string }): Promise<JSX.Element> {
  try {
    const [hobby, item, metrics] = await Promise.all([
      getHobbyDetail(householdId, hobbyId),
      getHobbyCollectionItem(householdId, hobbyId, collectionItemId),
      getHobbyMetrics(householdId, hobbyId),
    ]);

    return (
      <>
        <header className="page-header">
          <div>
            <div style={{ display: "grid", gap: "4px" }}>
              <Link href="/hobbies" className="text-link" style={{ fontSize: "0.85rem" }}>← All Hobbies</Link>
              <Link href={`/hobbies/${hobbyId}?tab=collection`} className="text-link" style={{ fontSize: "0.85rem" }}>← {hobby.name}</Link>
            </div>
            <h1 style={{ marginTop: "4px" }}>{item.name}</h1>
          </div>
        </header>
        <div className="page-body">
          <HobbyCollectionItemDetailSurface householdId={householdId} hobbyId={hobbyId} item={item} metrics={metrics} />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="page-body"><p>Failed to load: {error.message}</p></div>;
    }
    throw error;
  }
}