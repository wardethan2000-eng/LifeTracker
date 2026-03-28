import type { JSX } from "react";
import { Suspense } from "react";
import { HobbySeriesList } from "../../../../../components/hobby-series-list";
import {
  ApiError,
  getHobbyDetail,
  getHobbySeries,
  getMe,
} from "../../../../../lib/api";

type HobbySectionPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function HobbySeriesPage({ params }: HobbySectionPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;
  const me = await getMe();
  const household = me.households[0];
  if (!household) return <p>No household found.</p>;

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading series…</div></div>}>
      <SeriesContent householdId={household.id} hobbyId={hobbyId} />
    </Suspense>
  );
}

async function SeriesContent({ householdId, hobbyId }: { householdId: string; hobbyId: string }): Promise<JSX.Element> {
  try {
    const [hobby, series] = await Promise.all([
      getHobbyDetail(householdId, hobbyId),
      getHobbySeries(householdId, hobbyId),
    ]);

    return <HobbySeriesList hobbyId={hobbyId} activityMode={hobby.activityMode} series={series} />;
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load series: {error.message}</p></div></div>;
    }
    throw error;
  }
}