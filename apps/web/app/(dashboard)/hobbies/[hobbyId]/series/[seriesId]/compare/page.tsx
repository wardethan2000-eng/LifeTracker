import type { JSX } from "react";
import Link from "next/link";
import { HobbySeriesCompare } from "../../../../../../../components/hobby-series-compare";
import { ApiError, compareHobbySeries, getEntries, getHobbyDetail, getHobbySessions, getMe } from "../../../../../../../lib/api";

type HobbySeriesComparePageProps = {
  params: Promise<{ hobbyId: string; seriesId: string }>;
  searchParams: Promise<{ sessions?: string | string[] }>;
};

function parseSelectedSessions(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  const raw = Array.isArray(value) ? value.flatMap((entry) => entry.split(",")) : value.split(",");
  return raw.map((entry) => entry.trim()).filter(Boolean);
}

export default async function HobbySeriesComparePage({ params, searchParams }: HobbySeriesComparePageProps): Promise<JSX.Element> {
  const { hobbyId, seriesId } = await params;
  const { sessions } = await searchParams;

  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return (
        <>
          <header className="page-header"><h1>Batch Comparison</h1></header>
          <div className="page-body"><p>No household found.</p></div>
        </>
      );
    }

    const selectedSessionIds = parseSelectedSessions(sessions);

    const [hobby, comparison, sessionSummaries] = await Promise.all([
      getHobbyDetail(household.id, hobbyId),
      compareHobbySeries(household.id, hobbyId, seriesId, selectedSessionIds.length > 0 ? { sessionIds: selectedSessionIds } : undefined),
      getHobbySessions(household.id, hobbyId),
    ]);

    const detailEntries = await Promise.all(
      comparison.sessions.map(async (sessionItem) => {
        const [lessons, issues, observations] = await Promise.all([
          getEntries(household.id, {
            entityType: "hobby_session",
            entityId: sessionItem.sessionId,
            entryType: "lesson",
            limit: 50,
          }),
          getEntries(household.id, {
            entityType: "hobby_session",
            entityId: sessionItem.sessionId,
            entryType: "issue",
            limit: 50,
          }),
          getEntries(household.id, {
            entityType: "hobby_session",
            entityId: sessionItem.sessionId,
            entryType: "observation",
            limit: 50,
          }),
        ]);

        const combinedEntries = [...lessons.items, ...issues.items, ...observations.items].sort((left, right) =>
          right.entryDate.localeCompare(left.entryDate),
        );

        return [sessionItem.sessionId, combinedEntries] as const;
      }),
    );

    return (
      <>
        <header className="page-header">
          <div>
            <div style={{ display: "grid", gap: "4px" }}>
              <Link href={`/hobbies/${hobbyId}/series/${seriesId}`} className="text-link" style={{ fontSize: "0.85rem" }}>
                ← Back to {comparison.series.name}
              </Link>
              <Link href={`/hobbies/${hobbyId}?tab=series`} className="text-link" style={{ fontSize: "0.85rem" }}>
                ← Back to {hobby.name}
              </Link>
            </div>
            <h1 style={{ marginTop: "4px" }}>Batch Comparison</h1>
          </div>
        </header>

        <div className="page-body">
          <HobbySeriesCompare
            hobbyId={hobbyId}
            comparison={comparison}
            sessionSummaries={sessionSummaries.filter((sessionItem) => comparison.sessions.some((candidate) => candidate.sessionId === sessionItem.id))}
            sessionEntries={Object.fromEntries(detailEntries)}
            selectedSessionIds={selectedSessionIds}
          />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Batch Comparison</h1></header>
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