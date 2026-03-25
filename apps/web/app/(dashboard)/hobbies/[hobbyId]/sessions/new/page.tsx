import type { JSX } from "react";
import Link from "next/link";
import { createHobbySessionAction } from "../../../../../actions";
import { HobbySessionWorkbench } from "../../../../../../components/hobby-session-workbench";
import {
  ApiError,
  getHobbyDetail,
  getHobbyRecipes,
  getHobbySeries,
  getHobbySeriesDetail,
  getMe,
  listHobbyCollectionItems,
  listHobbyPracticeGoals,
  listHobbyPracticeRoutines,
} from "../../../../../../lib/api";

type NewHobbySessionPageProps = {
  params: Promise<{ hobbyId: string }>;
  searchParams: Promise<{ seriesId?: string }>;
};

export default async function NewHobbySessionPage({ params, searchParams }: NewHobbySessionPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;
  const { seriesId } = await searchParams;

  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return (
        <>
          <header className="page-header"><h1>New Session</h1></header>
          <div className="page-body"><p>No household found.</p></div>
        </>
      );
    }

    const [hobby, recipes, activeSeries, goals, routines, collectionItems] = await Promise.all([
      getHobbyDetail(household.id, hobbyId),
      getHobbyRecipes(household.id, hobbyId),
      getHobbySeries(household.id, hobbyId, { status: "active" }),
      listHobbyPracticeGoals(household.id, hobbyId, { status: "active", limit: 12 }),
      listHobbyPracticeRoutines(household.id, hobbyId, { isActive: true, limit: 12 }),
      listHobbyCollectionItems(household.id, hobbyId, { limit: 50 }),
    ]);

    const activeSeriesDetails = await Promise.all(
      activeSeries.map((series) => getHobbySeriesDetail(household.id, hobbyId, series.id)),
    );

    return (
      <>
        <header className="page-header">
          <div>
            <Link href={`/hobbies/${hobbyId}?tab=sessions`} className="text-link" style={{ fontSize: "0.85rem" }}>
              ← {hobby.name}
            </Link>
            <h1 style={{ marginTop: "4px" }}>New Session</h1>
          </div>
        </header>

        <div className="page-body">
          <HobbySessionWorkbench
            action={createHobbySessionAction}
            householdId={household.id}
            hobbyId={hobbyId}
            activityMode={hobby.activityMode}
            recipes={recipes}
            activeSeries={activeSeriesDetails}
            activeGoals={goals.items}
            activeRoutines={routines.items}
            collectionItems={collectionItems.items}
            initialSeriesSelection={seriesId}
          />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>New Session</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load: {error.message}</p>
              </div>
            </div>
          </div>
        </>
      );
    }

    throw error;
  }
}