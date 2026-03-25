import type { JSX } from "react";
import { HobbyPracticeTab } from "../../../../../components/hobby-practice-tab";
import {
  ApiError,
  getHobbyDetail,
  getHobbyMetrics,
  getMe,
  listHobbyPracticeGoals,
  listHobbyPracticeRoutines,
} from "../../../../../lib/api";

type HobbySectionPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function HobbyPracticePage({ params }: HobbySectionPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    const [hobby, practiceGoals, practiceRoutines, metrics] = await Promise.all([
      getHobbyDetail(household.id, hobbyId),
      listHobbyPracticeGoals(household.id, hobbyId, { limit: 100 }),
      listHobbyPracticeRoutines(household.id, hobbyId, { limit: 100 }),
      getHobbyMetrics(household.id, hobbyId),
    ]);

    return (
      <HobbyPracticeTab
        householdId={household.id}
        hobbyId={hobbyId}
        activityMode={hobby.activityMode}
        goals={practiceGoals.items}
        routines={practiceRoutines.items}
        metrics={metrics}
      />
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load practice: {error.message}</p></div></div>;
    }
    throw error;
  }
}