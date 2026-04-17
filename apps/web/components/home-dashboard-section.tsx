import {
  getCanvasesWithGeometry,
  getDashboardPins,
  getEntries,
  getHouseholdHobbies,
  getHouseholdIdeas,
  getHouseholdInventory,
  getHouseholdLowStockInventory,
  getHouseholdProjectStatusCounts,
  getHouseholdSpacesTree,
  getInventoryShoppingList,
  getLayoutPreference,
  getQuickActionsPreference,
} from "../lib/api";
import { getDashboardData } from "./dashboard-data";
import { HomeDashboard } from "./home-dashboard";
import { formatCategoryLabel, formatDateTime, formatDueLabel } from "../lib/formatters";

/**
 * Async server component. Fetches all secondary dashboard data (ideas,
 * inventory, spaces, canvases, pinned notes, pins, layout) and renders the
 * HomeDashboard grid. getDashboardData is React-cached so calling it here
 * deduplicates with the DashboardAttentionSection call in the same render.
 *
 * Wrapped in <Suspense> in page.tsx so it streams in independently of the
 * attention queue and reminders sections.
 */
export async function HomeDashboardSection({ householdId }: { householdId: string }) {
  const [
    dashboard,
    pins,
    recentIdeas,
    projectStatusCounts,
    hobbyData,
    inventoryData,
    lowStockItems,
    shoppingList,
    savedQuickActionIds,
    pinnedNotes,
    canvases,
    spacesTree,
    homeLayout,
  ] = await Promise.all([
    getDashboardData(householdId),
    getDashboardPins().catch(() => []),
    getHouseholdIdeas(householdId, { limit: 5 }).catch(() => []),
    getHouseholdProjectStatusCounts(householdId).catch(() => []),
    getHouseholdHobbies(householdId, { limit: 1 }).catch(() => ({ items: [], nextCursor: null })),
    getHouseholdInventory(householdId, { limit: 20 }).catch(() => ({ items: [], nextCursor: null })),
    getHouseholdLowStockInventory(householdId).catch(() => []),
    getInventoryShoppingList(householdId).catch(() => null),
    getQuickActionsPreference().catch(() => null),
    // 30-second ISR is fine for pinned notes — pinning state is stable.
    getEntries(householdId, { flags: ["pinned"], limit: 10, cacheOptions: { revalidate: 30 } }).catch(() => ({ items: [], nextCursor: null })),
    getCanvasesWithGeometry(householdId).catch(() => []),
    getHouseholdSpacesTree(householdId).catch(() => []),
    getLayoutPreference("home").catch(() => null),
  ]);

  const countAllSpaces = (nodes: typeof spacesTree): number =>
    nodes.reduce((sum, n) => sum + 1 + countAllSpaces(n.children ?? []), 0);
  const rootSpaceCount = spacesTree.length;
  const totalSpaceCount = countAllSpaces(spacesTree);

  const inventoryCount = inventoryData.items.length;
  const lowStockCount = lowStockItems.length;
  const pendingOrderCount = shoppingList?.purchaseCount ?? 0;
  const outOfStockCount = inventoryData.items.filter((i) => i.quantityOnHand <= 0).length;
  const nowMs = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const expiringCount = inventoryData.items.filter((i) => {
    if (!i.expiresAt) return false;
    const expiresMs = new Date(i.expiresAt).getTime();
    return expiresMs <= nowMs + thirtyDaysMs;
  }).length;

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
    <HomeDashboard
      householdId={householdId}
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
      expiringCount={expiringCount}
      pendingOrderCount={pendingOrderCount}
      spaceTotalCount={totalSpaceCount}
      rootSpaceCount={rootSpaceCount}
      ideas={recentIdeas.map((idea) => ({
        id: idea.id,
        title: idea.title,
        stage: idea.stage,
        priority: idea.priority,
        promotionTarget: idea.promotionTarget,
      }))}
      pinnedNotes={pinnedNotes.items}
      canvases={canvases}
      {...(homeLayout?.layoutJson ? { serverLayout: homeLayout.layoutJson } : {})}
    />
  );
}
