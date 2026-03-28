import type { JSX } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { HobbySessionDetail } from "../../../../../../components/hobby-session-detail";
import { deleteHobbySessionAction } from "../../../../../actions";
import {
  ApiError,
  getHobbyDetail,
  getHobbySeriesDetail,
  getHobbySessionDetail,
  getMe,
} from "../../../../../../lib/api";

type SessionDetailPageProps = {
  params: Promise<{ hobbyId: string; sessionId: string }>;
};

export default async function SessionDetailPage({ params }: SessionDetailPageProps): Promise<JSX.Element> {
  const { hobbyId, sessionId } = await params;
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

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading session…</div></div>}>
      <SessionContent householdId={household.id} hobbyId={hobbyId} sessionId={sessionId} />
    </Suspense>
  );
}

async function SessionContent({ householdId, hobbyId, sessionId }: { householdId: string; hobbyId: string; sessionId: string }): Promise<JSX.Element> {
  try {
    const [hobby, session] = await Promise.all([
      getHobbyDetail(householdId, hobbyId),
      getHobbySessionDetail(householdId, hobbyId, sessionId),
    ]);

    const series = session.seriesId ? await getHobbySeriesDetail(householdId, hobbyId, session.seriesId) : null;

    return (
      <>
        <header className="page-header">
          <div>
            <div style={{ display: "grid", gap: "4px" }}>
              <Link href="/hobbies" className="text-link" style={{ fontSize: "0.85rem" }}>
                ← All Hobbies
              </Link>
              <Link href={`/hobbies/${hobbyId}`} className="text-link" style={{ fontSize: "0.85rem" }}>
                ← {hobby.name}
              </Link>
            </div>
            <h1 style={{ marginTop: "4px" }}>{session.name}</h1>
            {session.recipeName ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "0.9rem" }}>
                From recipe: {session.recipeName}
              </p>
            ) : null}
            {series && session.batchNumber ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "0.9rem", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <span className="pill pill--success">Series</span>
                <Link href={`/hobbies/${hobbyId}/series/${series.id}`} className="text-link">
                  {series.name} · Batch {session.batchNumber}
                </Link>
              </p>
            ) : null}
          </div>
        </header>
        <HobbySessionDetail
          householdId={householdId}
          hobbyId={hobbyId}
          hobby={hobby}
          session={session}
          series={series}
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
