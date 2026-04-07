import type { JSX } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { HobbyPracticeRoutineDetail } from "../../../../../../components/hobby-practice-detail";
import {
  ApiError,
  getHobbyDetail,
  getHobbyPracticeRoutine,
  getHobbyPracticeRoutineCompliance,
  getHobbySessions,
  getMe,
} from "../../../../../../lib/api";

type HobbyRoutineDetailPageProps = {
  params: Promise<{ hobbyId: string; routineId: string }>;
};

export default async function HobbyRoutineDetailPage({ params }: HobbyRoutineDetailPageProps): Promise<JSX.Element> {
  const { hobbyId, routineId } = await params;
  const me = await getMe();
  const household = me.households[0];
  if (!household) {
    return <div className="page-body"><p>No household found.</p></div>;
  }

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section>}>
      <RoutineContent householdId={household.id} hobbyId={hobbyId} routineId={routineId} />
    </Suspense>
  );
}

async function RoutineContent({ householdId, hobbyId, routineId }: { householdId: string; hobbyId: string; routineId: string }): Promise<JSX.Element> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 83);

    const [hobby, routine, compliance, sessions] = await Promise.all([
      getHobbyDetail(householdId, hobbyId),
      getHobbyPracticeRoutine(householdId, hobbyId, routineId),
      getHobbyPracticeRoutineCompliance(householdId, hobbyId, routineId, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      }),
      getHobbySessions(householdId, hobbyId),
    ]);

    return (
      <>
        <header className="page-header">
          <div>
            <div style={{ display: "grid", gap: "4px" }}>
              <Link href="/hobbies" className="text-link" style={{ fontSize: "0.85rem" }}>← All Hobbies</Link>
              <Link href={`/hobbies/${hobbyId}?tab=practice`} className="text-link" style={{ fontSize: "0.85rem" }}>← {hobby.name}</Link>
            </div>
            <h1 style={{ marginTop: "4px" }}>{routine.name}</h1>
          </div>
        </header>
        <div className="page-body">
          <HobbyPracticeRoutineDetail hobbyId={hobbyId} routine={routine} compliance={compliance} sessions={sessions} />
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