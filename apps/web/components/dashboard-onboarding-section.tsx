import {
  getEntries,
  getHouseholdHobbies,
  getHouseholdIdeas,
  getHouseholdInventory,
  getHouseholdProjectStatusCounts,
  getLayoutPreference,
} from "../lib/api";
import { getDashboardData } from "./dashboard-data";
import { OnboardingChecklistClient } from "./onboarding-checklist";

/**
 * Async server component. Short-circuits immediately when the user has
 * already dismissed onboarding — avoiding all the count fetches. When
 * onboarding is active, fetches the counts needed for completion tracking.
 * Wrapped in <Suspense> in page.tsx.
 */
export async function DashboardOnboardingSection({ householdId }: { householdId: string }) {
  // Check dismissal first — most users have dismissed this, so it returns null
  // without making any further API calls.
  const onboardingPref = await getLayoutPreference("onboarding", "dismissed").catch(() => null);
  if (onboardingPref !== null) return null;

  const [dashboard, entryProbe, projectStatusCounts, hobbyData, inventoryData, ideaData] = await Promise.all([
    getDashboardData(householdId),
    // 60-second ISR is fine for the onboarding probe — a 1-minute stale count is acceptable.
    getEntries(householdId, { limit: 1, cacheOptions: { revalidate: 60 } }).catch(() => ({ items: [], nextCursor: null })),
    getHouseholdProjectStatusCounts(householdId).catch(() => []),
    getHouseholdHobbies(householdId, { limit: 1 }).catch(() => ({ items: [], nextCursor: null })),
    getHouseholdInventory(householdId, { limit: 1 }).catch(() => ({ items: [], nextCursor: null })),
    getHouseholdIdeas(householdId, { limit: 1 }).catch(() => []),
  ]);

  const projectCount = projectStatusCounts.reduce((sum, s) => sum + s.count, 0);

  return (
    <OnboardingChecklistClient
      assetCount={dashboard.stats.assetCount}
      householdId={householdId}
      projectCount={projectCount}
      hobbyCount={hobbyData.items.length}
      inventoryItemCount={inventoryData.items.length}
      ideaCount={Array.isArray(ideaData) ? ideaData.length : 0}
      entryCount={entryProbe.items.length}
      maintenanceScheduleCount={dashboard.stats.dueScheduleCount + dashboard.stats.overdueScheduleCount}
    />
  );
}
