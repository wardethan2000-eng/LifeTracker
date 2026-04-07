import type { JSX } from "react";
import { Suspense } from "react";
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
  const me = await getMe();
  const household = me.households[0];
  if (!household) return <p>No household found.</p>;

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{display:"grid",gap:12}}>{[1,2,3].map((i)=>(<div key={i} className="skeleton-bar" style={{width:"100%",height:52,borderRadius:6}}/>))}</div></section>}>
      <PracticeContent householdId={household.id} hobbyId={hobbyId} />
    </Suspense>
  );
}

async function PracticeContent({ householdId, hobbyId }: { householdId: string; hobbyId: string }): Promise<JSX.Element> {
  try {
    const [hobby, practiceGoals, practiceRoutines, metrics] = await Promise.all([
      getHobbyDetail(householdId, hobbyId),
      listHobbyPracticeGoals(householdId, hobbyId, { limit: 100 }),
      listHobbyPracticeRoutines(householdId, hobbyId, { limit: 100 }),
      getHobbyMetrics(householdId, hobbyId),
    ]);

    return (
      <HobbyPracticeTab
        householdId={householdId}
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