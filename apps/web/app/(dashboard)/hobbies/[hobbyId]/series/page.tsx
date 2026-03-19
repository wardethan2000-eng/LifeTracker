import type { JSX } from "react";
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

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    const [hobby, series] = await Promise.all([
      getHobbyDetail(household.id, hobbyId),
      getHobbySeries(household.id, hobbyId),
    ]);

    return <HobbySeriesList hobbyId={hobbyId} activityMode={hobby.activityMode} series={series} />;
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load series: {error.message}</p></div></div>;
    }
    throw error;
  }
}