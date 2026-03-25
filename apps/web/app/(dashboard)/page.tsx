import Link from "next/link";
import type { JSX } from "react";
import { createHouseholdAction } from "../actions";
import { getDashboardData } from "../../components/dashboard-data";
import { HomeDashboard } from "../../components/home-dashboard";
import { LaunchPad } from "../../components/launch-pad";
import { RealtimeRefreshBoundary } from "../../components/realtime-refresh-boundary";
import { ApiError, getApiBaseUrl, getDevUserId, getDashboardPins, getEntries, getHouseholdHobbies, getHouseholdIdeas, getHouseholdInventory, getHouseholdLowStockInventory, getHouseholdProjectStatusCounts, getLayoutPreference, getMe, getQuickActionsPreference } from "../../lib/api";
import { OnboardingChecklistClient } from "../../components/onboarding-checklist";
import { DashboardReminders } from "../../components/dashboard-reminders";
import { formatCategoryLabel, formatDateTime, formatDueLabel } from "../../lib/formatters";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getParam = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string" && value.length > 0) return value;
  return Array.isArray(value) ? value[0] : undefined;
};

const DashboardError = ({ message }: { message: string }): JSX.Element => (
  <main className="error-shell">
    <section className="error-card">
      <p className="eyebrow">Connection error</p>
      <h1>Dashboard could not load</h1>
      <p>{message}</p>
      <dl className="meta-list">
        <div>
          <dt>API base URL</dt>
          <dd>{getApiBaseUrl()}</dd>
        </div>
        <div>
          <dt>Dev user header</dt>
          <dd>{getDevUserId()}</dd>
        </div>
      </dl>
      <p className="note">Start the API, seed the database, and keep dev auth bypass enabled for the seeded demo user.</p>
    </section>
  </main>
);

const EmptyHouseholds = (): JSX.Element => (
  <main className="error-shell">
    <section className="error-card">
      <p className="eyebrow">First-run setup</p>
      <h1>Create your first household</h1>
      <p>The dashboard is household-scoped. Create a household to start tracking assets.</p>
      <form action={createHouseholdAction} className="form-grid form-grid--single" style={{ gap: 12 }}>
        <label className="field">
          <span>Household name</span>
          <input type="text" name="name" placeholder="Main household" required />
        </label>
        <button type="submit" className="button button--primary">Create household</button>
      </form>
    </section>
  </main>
);

export default async function HomePage({ searchParams }: HomePageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};

  try {
    const me = await getMe();
    const fallbackHousehold = me.households[0];

    if (!fallbackHousehold) return <EmptyHouseholds />;

    const requestedHouseholdId = getParam(params.householdId);
    const selectedHousehold = me.households.find((h) => h.id === requestedHouseholdId) ?? fallbackHousehold;
    const [dashboard, pins, recentIdeas, projectStatusCounts, hobbyData, inventoryData, lowStockItems, onboardingPref, savedQuickActionIds, reminderWindowPref, entryProbe] = await Promise.all([
      getDashboardData(selectedHousehold.id),
      getDashboardPins().catch(() => []),
      getHouseholdIdeas(selectedHousehold.id, { limit: 5 }).catch(() => []),
      getHouseholdProjectStatusCounts(selectedHousehold.id).catch(() => []),
      getHouseholdHobbies(selectedHousehold.id, { limit: 1 }).catch(() => ({ items: [], nextCursor: null })),
      getHouseholdInventory(selectedHousehold.id, { limit: 100 }).catch(() => ({ items: [], nextCursor: null })),
      getHouseholdLowStockInventory(selectedHousehold.id).catch(() => []),
      getLayoutPreference("onboarding", "dismissed").catch(() => null),
      getQuickActionsPreference().catch(() => null),
      getLayoutPreference("reminders_dashboard", "window_days").catch(() => null),
      getEntries(selectedHousehold.id, { limit: 1 }).catch(() => ({ items: [], nextCursor: null })),
    ]);

    const reminderWindowDays = (reminderWindowPref as Array<{ value: number }> | null)?.[0]?.value ?? 7;
    const reminderCutoff = new Date(Date.now() + reminderWindowDays * 24 * 60 * 60 * 1000).toISOString();
    const reminderEntries = await getEntries(selectedHousehold.id, {
      hasReminder: true,
      reminderBefore: reminderCutoff,
      limit: 20,
    }).catch(() => ({ items: [], nextCursor: null }));

    const projectCount = projectStatusCounts.reduce((sum, s) => sum + s.count, 0);
    const hobbyCount = hobbyData.items.length;
    const inventoryCount = inventoryData.items.length;
    const ideaCount = recentIdeas.length;
    const entryCount = entryProbe.items.length;
    const onboardingDismissed = onboardingPref !== null;
    const lowStockCount = lowStockItems.length;
    const outOfStockCount = inventoryData.items.filter((i) => i.quantityOnHand <= 0).length;

    const sortedAssets = [...dashboard.assets].sort(
      (a, b) => (b.overdueScheduleCount - a.overdueScheduleCount) || (b.dueScheduleCount - a.dueScheduleCount)
    );
    const overdueAssetCount = sortedAssets.filter((a) => a.overdueScheduleCount > 0).length;
    const dueAssetCount = sortedAssets.filter((a) => a.overdueScheduleCount === 0 && a.dueScheduleCount > 0).length;

    const dueWork = dashboard.dueWork.slice(0, 8).map((item) => ({
      scheduleId: item.scheduleId,
      assetId: item.assetId,
      assetName: item.assetName,
      scheduleName: item.scheduleName,
      status: item.status,
      nextDueLabel: formatDueLabel(item.nextDueAt, item.nextDueMetricValue, item.metricUnit),
    }));

    const topAssets = sortedAssets.slice(0, 10).map((item) => ({
      id: item.asset.id,
      name: item.asset.name,
      category: formatCategoryLabel(item.asset.category),
      overdueCount: item.overdueScheduleCount,
      dueCount: item.dueScheduleCount,
      tone: item.overdueScheduleCount > 0
        ? "overdue"
        : item.dueScheduleCount > 0
          ? "due"
          : item.nextDueAt
            ? "upcoming"
            : "clear",
    }));

    const notifications = dashboard.notifications.slice(0, 5).map((n) => {
      const payload = n.payload as Record<string, unknown> | null;
      const href = n.assetId
        ? `/assets/${n.assetId}`
        : (payload && payload.entityType === "project" && typeof payload.entityId === "string")
          ? `/projects/${payload.entityId}`
          : null;
      return {
        id: n.id,
        title: n.title,
        body: n.body,
        scheduledFor: formatDateTime(n.scheduledFor),
        href,
      };
    });

    const firstDueWork = dashboard.dueWork[0];

    return (
      <>
        <RealtimeRefreshBoundary householdId={selectedHousehold.id} eventTypes={["asset.updated", "inventory.changed", "maintenance.completed", "hobby.session-progress"]} />
        <header className="page-header">
          <h1>Dashboard</h1>
          <div className="page-header__actions">
            {me.households.length > 1 && (
              <div className="household-switcher">
                {me.households.map((h) => (
                  <Link
                    key={h.id}
                    href={`/?householdId=${h.id}`}
                    className={`household-chip${h.id === selectedHousehold.id ? " household-chip--active" : ""}`}
                  >
                    {h.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </header>

        <div className="page-body">
          <LaunchPad />
          <DashboardReminders
            householdId={selectedHousehold.id}
            entries={reminderEntries.items}
            windowDays={reminderWindowDays}
          />
          {!onboardingDismissed && (
            <OnboardingChecklistClient
              assetCount={dashboard.stats.assetCount}
              householdId={selectedHousehold.id}
              projectCount={projectCount}
              hobbyCount={hobbyCount}
              inventoryItemCount={inventoryCount}
              ideaCount={ideaCount}
              entryCount={entryCount}
              maintenanceScheduleCount={dashboard.stats.dueScheduleCount + dashboard.stats.overdueScheduleCount}
            />
          )}
          <HomeDashboard
            householdId={selectedHousehold.id}
            assetCount={dashboard.stats.assetCount}
            overdueScheduleCount={dashboard.stats.overdueScheduleCount}
            dueScheduleCount={dashboard.stats.dueScheduleCount}
            unreadNotificationCount={dashboard.stats.unreadNotificationCount}
            overdueAssetCount={overdueAssetCount}
            dueAssetCount={dueAssetCount}
            latestAlertTime={dashboard.notifications.length > 0 ? formatDateTime(dashboard.notifications[0]?.scheduledFor) : null}
            dueWork={dueWork}
            topAssets={topAssets}
            notifications={notifications}
            nextDueAssetId={firstDueWork?.assetId ?? null}
            nextDueAssetName={firstDueWork?.assetName ?? null}
            pins={pins}
            savedQuickActionIds={savedQuickActionIds}
            inventoryTotalCount={inventoryCount}
            lowStockCount={lowStockCount}
            outOfStockCount={outOfStockCount}
            ideas={recentIdeas.map((idea) => ({
              id: idea.id,
              title: idea.title,
              stage: idea.stage,
              priority: idea.priority,
              promotionTarget: idea.promotionTarget,
            }))}
          />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) return <DashboardError message={error.message} />;
    throw error;
  }
}