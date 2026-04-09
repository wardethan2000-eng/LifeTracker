import type { JSX } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { deleteHobbySeriesAction } from "../../../../../actions";
import { HobbySeriesDetail } from "../../../../../../components/hobby-series-detail";
import { ApiError, getHobbyDetail, getHobbySeriesDetail, getHobbySessions, getMe } from "../../../../../../lib/api";

type HobbySeriesDetailPageProps = {
  params: Promise<{ hobbyId: string; seriesId: string }>;
};

export default async function HobbySeriesDetailPage({ params }: HobbySeriesDetailPageProps): Promise<JSX.Element> {
  const { hobbyId, seriesId } = await params;
  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return (
      <>
        <header className="page-header"><h1>Series</h1></header>
        <div className="page-body"><p>No household found.</p></div>
      </>
    );
  }

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section>}>
      <SeriesDetailContent householdId={household.id} hobbyId={hobbyId} seriesId={seriesId} />
    </Suspense>
  );
}

async function SeriesDetailContent({ householdId, hobbyId, seriesId }: { householdId: string; hobbyId: string; seriesId: string }): Promise<JSX.Element> {
  try {
    const [hobby, series, sessions] = await Promise.all([
      getHobbyDetail(householdId, hobbyId),
      getHobbySeriesDetail(householdId, hobbyId, seriesId),
      getHobbySessions(householdId, hobbyId),
    ]);

    return (
      <>
        <header className="page-header">
          <div>
            <div style={{ display: "grid", gap: "4px" }}>
              <Link href="/hobbies" className="text-link" style={{ fontSize: "0.85rem" }}>
                ← All Hobbies
              </Link>
              <Link href={`/hobbies/${hobbyId}?tab=series`} className="text-link" style={{ fontSize: "0.85rem" }}>
                ← {hobby.name}
              </Link>
            </div>
            <h1 style={{ marginTop: "4px" }}>{series.name}</h1>
            <p style={{ color: "var(--ink-muted)", fontSize: "0.9rem" }}>
              {series.batchCount} batches · {series.status}
            </p>
          </div>
        </header>

        <div className="page-body">
          <HobbySeriesDetail
            householdId={householdId}
            hobbyId={hobbyId}
            series={series}
            allSessions={sessions}
            deleteHobbySeriesAction={deleteHobbySeriesAction}
          />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Series</h1></header>
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