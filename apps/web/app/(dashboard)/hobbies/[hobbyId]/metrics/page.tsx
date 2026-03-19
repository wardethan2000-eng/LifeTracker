import type { JSX } from "react";
import { HobbyMetricsManager } from "../../../../../components/hobby-metrics-manager";
import {
  ApiError,
  getHobbyMetrics,
  getHobbyMetricReadings,
  getMe,
} from "../../../../../lib/api";
import type { HobbyMetricReading } from "@lifekeeper/types";

type HobbySectionPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function HobbyMetricsPage({ params }: HobbySectionPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    const metrics = await getHobbyMetrics(household.id, hobbyId);

    const metricReadingsMap: Record<string, HobbyMetricReading[]> = {};
    await Promise.all(
      metrics.map(async (m) => {
        metricReadingsMap[m.id] = await getHobbyMetricReadings(household.id, hobbyId, m.id);
      })
    );

    return (
      <HobbyMetricsManager
        householdId={household.id}
        hobbyId={hobbyId}
        initialMetrics={metrics}
        initialReadingsMap={metricReadingsMap}
      />
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load metrics: {error.message}</p></div></div>;
    }
    throw error;
  }
}