import type { JSX } from "react";
import Link from "next/link";
import { HobbySessionDetail } from "../../../../../../components/hobby-session-detail";
import {
  advanceHobbySessionAction,
  deleteHobbySessionAction,
} from "../../../../../actions";
import {
  ApiError,
  getHobbyDetail,
  getHobbySessionDetail,
  getMe,
} from "../../../../../../lib/api";

type SessionDetailPageProps = {
  params: Promise<{ hobbyId: string; sessionId: string }>;
};

export default async function SessionDetailPage({ params }: SessionDetailPageProps): Promise<JSX.Element> {
  const { hobbyId, sessionId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) {
      return (
        <>
          <header className="page-header"><h1>Session</h1></header>
          <div className="page-body"><p>No household found.</p></div>
        </>
      );
    }

    const [hobby, session] = await Promise.all([
      getHobbyDetail(household.id, hobbyId),
      getHobbySessionDetail(household.id, hobbyId, sessionId),
    ]);

    return (
      <>
        <header className="page-header">
          <div>
            <div style={{ display: "grid", gap: "4px" }}>
              <Link href="/hobbies" className="text-link" style={{ fontSize: "0.85rem" }}>
                ← All Hobbies
              </Link>
              <Link href={`/hobbies/${hobbyId}`} className="text-link" style={{ fontSize: "0.85rem" }}>
                ← Back to {hobby.name}
              </Link>
            </div>
            <h1 style={{ marginTop: "4px" }}>{session.name}</h1>
            {session.recipeName ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "0.9rem" }}>
                From recipe: {session.recipeName}
              </p>
            ) : null}
          </div>
        </header>
        <HobbySessionDetail
          householdId={household.id}
          hobbyId={hobbyId}
          hobby={hobby}
          session={session}
          advanceHobbySessionAction={advanceHobbySessionAction}
          deleteHobbySessionAction={deleteHobbySessionAction}
        />
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Session</h1></header>
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
