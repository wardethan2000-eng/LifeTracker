import type { JSX } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { HobbyPracticeGoalDetail } from "../../../../../../components/hobby-practice-detail";
import { ApiError, getHobbyDetail, getHobbyMetrics, getHobbyPracticeGoal, getHobbySessions, getMe } from "../../../../../../lib/api";

type HobbyGoalDetailPageProps = {
  params: Promise<{ hobbyId: string; goalId: string }>;
};

export default async function HobbyGoalDetailPage({ params }: HobbyGoalDetailPageProps): Promise<JSX.Element> {
  const { hobbyId, goalId } = await params;
  const me = await getMe();
  const household = me.households[0];
  if (!household) {
    return <div className="page-body"><p>No household found.</p></div>;
  }

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section>}>
      <GoalContent householdId={household.id} hobbyId={hobbyId} goalId={goalId} />
    </Suspense>
  );
}

async function GoalContent({ householdId, hobbyId, goalId }: { householdId: string; hobbyId: string; goalId: string }): Promise<JSX.Element> {
  try {
    const [hobby, goal, sessions, metrics] = await Promise.all([
      getHobbyDetail(householdId, hobbyId),
      getHobbyPracticeGoal(householdId, hobbyId, goalId),
      getHobbySessions(householdId, hobbyId),
      getHobbyMetrics(householdId, hobbyId),
    ]);

    return (
      <>
        <header className="page-header">
          <div>
            <div style={{ display: "grid", gap: "4px" }}>
              <Link href="/hobbies" className="text-link" style={{ fontSize: "0.85rem" }}>← All Hobbies</Link>
              <Link href={`/hobbies/${hobbyId}?tab=practice`} className="text-link" style={{ fontSize: "0.85rem" }}>← {hobby.name}</Link>
            </div>
            <h1 style={{ marginTop: "4px" }}>{goal.name}</h1>
          </div>
        </header>
        <div className="page-body">
          <HobbyPracticeGoalDetail householdId={householdId} hobbyId={hobbyId} goal={goal} sessions={sessions} metrics={metrics} />
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