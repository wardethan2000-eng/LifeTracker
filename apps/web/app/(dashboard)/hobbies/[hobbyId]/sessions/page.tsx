import type { JSX } from "react";
import { Suspense } from "react";
import { HobbySessionList } from "../../../../../components/hobby-session-list";
import {
  ApiError,
  getHobbySessions,
  getMe,
} from "../../../../../lib/api";

type HobbySectionPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function HobbySessionsPage({ params }: HobbySectionPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;
  const me = await getMe();
  const household = me.households[0];
  if (!household) return <p>No household found.</p>;

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading sessions…</div></div>}>
      <SessionsContent householdId={household.id} hobbyId={hobbyId} />
    </Suspense>
  );
}

async function SessionsContent({ householdId, hobbyId }: { householdId: string; hobbyId: string }): Promise<JSX.Element> {
  try {
    const sessions = await getHobbySessions(householdId, hobbyId);
    return <HobbySessionList hobbyId={hobbyId} householdId={householdId} sessions={sessions} />;
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load sessions: {error.message}</p></div></div>;
    }
    throw error;
  }
}