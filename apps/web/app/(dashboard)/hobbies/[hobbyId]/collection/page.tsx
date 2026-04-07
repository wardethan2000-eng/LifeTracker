import type { JSX } from "react";
import { Suspense } from "react";
import { HobbyCollectionTab } from "../../../../../components/hobby-collection-tab";
import {
  ApiError,
  getHobbyDetail,
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
    const [hobby, collectionItems] = await Promise.all([
      getHobbyDetail(householdId, hobbyId),
      listHobbyCollectionItems(householdId, hobbyId, { limit: 100 }),
    ]);

    return <HobbyCollectionTab hobbyId={hobbyId} activityMode={hobby.activityMode} items={collectionItems.items} />;
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load collection: {error.message}</p></div></div>;
    }
    throw error;
  }
}