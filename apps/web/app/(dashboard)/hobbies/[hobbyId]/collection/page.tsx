import type { JSX } from "react";
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

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    const [hobby, collectionItems] = await Promise.all([
      getHobbyDetail(household.id, hobbyId),
      listHobbyCollectionItems(household.id, hobbyId, { limit: 100 }),
    ]);

    return <HobbyCollectionTab hobbyId={hobbyId} activityMode={hobby.activityMode} items={collectionItems.items} />;
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load collection: {error.message}</p></div></div>;
    }
    throw error;
  }
}