import type { JSX } from "react";
import Link from "next/link";
import { HobbyPracticeGoalDetail } from "../../../../../../components/hobby-practice-detail";
import { ApiError, getHobbyDetail, getHobbyMetrics, getHobbyPracticeGoal, getHobbySessions, getMe } from "../../../../../../lib/api";

type HobbyGoalDetailPageProps = {
  params: Promise<{ hobbyId: string; goalId: string }>;
};

export default async function HobbyGoalDetailPage({ params }: HobbyGoalDetailPageProps): Promise<JSX.Element> {
  const { hobbyId, goalId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) {
      return <div className="page-body"><p>No household found.</p></div>;
    }

    const [hobby, goal, sessions, metrics] = await Promise.all([
      getHobbyDetail(household.id, hobbyId),
      getHobbyPracticeGoal(household.id, hobbyId, goalId),
      getHobbySessions(household.id, hobbyId),
      getHobbyMetrics(household.id, hobbyId),
    ]);

    return (
      <>
        <header className="page-header">
          <div>
            <div style={{ display: "grid", gap: "4px" }}>
              <Link href="/hobbies" className="text-link" style={{ fontSize: "0.85rem" }}>← All Hobbies</Link>
              <Link href={`/hobbies/${hobbyId}?tab=practice`} className="text-link" style={{ fontSize: "0.85rem" }}>← Back to {hobby.name}</Link>
            </div>
            <h1 style={{ marginTop: "4px" }}>{goal.name}</h1>
          </div>
        </header>
        <div className="page-body">
          <HobbyPracticeGoalDetail householdId={household.id} hobbyId={hobbyId} goal={goal} sessions={sessions} metrics={metrics} />
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