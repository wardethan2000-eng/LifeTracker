import type { JSX } from "react";
import { Suspense } from "react";
import { HobbyMetricsManager } from "../../../../../components/hobby-metrics-manager";
import {
  ApiError,
  getHobbyMetrics,
  getHobbyMetricReadings,
  getMe,
} from "../../../../../lib/api";
import type { HobbyMetricReading } from "@aegis/types";

type HobbySectionPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function HobbyMetricsPage({ params }: HobbySectionPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;
  const me = await getMe();
  const household = me.households[0];
  if (!household) return <p>No household found.</p>;

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading metrics…</div></div>}>
      <MetricsContent householdId={household.id} hobbyId={hobbyId} />
    </Suspense>
  );
}

async function MetricsContent({ householdId, hobbyId }: { householdId: string; hobbyId: string }): Promise<JSX.Element> {
  try {
    const metrics = await getHobbyMetrics(householdId, hobbyId);

    const metricReadingsMap: Record<string, HobbyMetricReading[]> = {};
    await Promise.all(
      metrics.map(async (m) => {
        metricReadingsMap[m.id] = await getHobbyMetricReadings(householdId, hobbyId, m.id);
      })
    );

    return (
      <HobbyMetricsManager
        householdId={householdId}
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