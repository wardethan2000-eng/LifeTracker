import type { JSX } from "react";
import {
  getHouseholdSpacesTree,
  getRecentSpaceScans,
  getSpaceOrphanCount,
  getSpaceUtilization
} from "../lib/api";
import { SpacesSectionClient } from "./spaces-section-client";

type SpacesSectionProps = {
  householdId: string;
};

export async function SpacesSection({ householdId }: SpacesSectionProps): Promise<JSX.Element> {
  const [spaces, orphanCount, utilization, recentScans] = await Promise.all([
    getHouseholdSpacesTree(householdId),
    getSpaceOrphanCount(householdId),
    getSpaceUtilization(householdId),
    getRecentSpaceScans(householdId, 12)
  ]);

  return (
    <SpacesSectionClient
      householdId={householdId}
      spaces={spaces}
      orphanCount={orphanCount.count}
      utilization={utilization}
      recentScans={recentScans}
    />
  );
}