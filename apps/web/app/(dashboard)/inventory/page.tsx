import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { SkeletonBlock } from "../../../components/skeleton";
import { InventoryFilterBar } from "../../../components/inventory-filter-bar";
import { InventoryListWorkspace } from "../../../components/inventory-list-workspace";
import { InventoryQuickRestock } from "../../../components/inventory-quick-restock";
import { InventoryValuationReportButton } from "../../../components/report-download-actions";
import { InventoryShoppingListSection } from "../../../components/inventory-shopping-list-section";
import { InventoryTransactionHistory } from "../../../components/inventory-transaction-history";
import { Banner } from "../../../components/banner";
import { SpacesSection } from "../../../components/spaces-section";
import { TabNav } from "../../../components/tab-nav";
import {
  ApiError,
  getHouseholdInventory,
  getInventoryItemConsumption,
  getHouseholdLowStockInventory,
  getHouseholdSpacesTree,
  getInventoryShoppingList,
  getMe
} from "../../../lib/api";
import { formatCurrency } from "../../../lib/formatters";

type InventoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const normalizeUnit = (unit: string): string => unit.trim().toLowerCase();

const formatStockAmount = (value: number, unit: string): string => {
  const normalizedUnit = normalizeUnit(unit);

  if (value === 0) {
    return "Out of stock";
  }

  if (normalizedUnit === "each") {
    return `${value} item${value === 1 ? "" : "s"}`;
  }

  return `${value} ${unit}`;
};

const formatReorderPoint = (value: number | null, unit: string): string => {
  if (value === null) {
    return "No reorder trigger";
  }

  const normalizedUnit = normalizeUnit(unit);

  if (normalizedUnit === "each") {
    return `Reorder when ${value} item${value === 1 ? "" : "s"} remain`;
  }

  return `Reorder when ${value} ${unit} remain`;
};

const formatRestockPlan = (value: number | null, unit: string): string => {
  if (value === null) {
    return "No restock amount set";
  }

  const normalizedUnit = normalizeUnit(unit);

  if (normalizedUnit === "each") {
    return `Usually buy ${value} item${value === 1 ? "" : "s"}`;
  }

  return `Usually buy ${value} ${unit}`;
};

const buildInventoryHref = (householdId: string, params?: Record<string, string | undefined>): string => {
  const query = new URLSearchParams();
  query.set("householdId", householdId);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) {
      query.set(key, value);
    }
  }

  return `/inventory?${query.toString()}`;
};

const buildInventoryItemHref = (householdId: string, inventoryItemId: string): string => `/inventory/${inventoryItemId}?householdId=${householdId}`;

export default async function InventoryPage({ searchParams }: InventoryPageProps): Promise<JSX.Element> {
  // Fire getMe() immediately so it runs in parallel with i18n/params setup.
  const mePromise = getMe();
  const [t, tCommon, params] = await Promise.all([
    getTranslations("inventory"),
    getTranslations("common"),
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);
  const householdId = typeof params.householdId === "string" ? params.householdId : undefined;
  const highlightId = typeof params.highlight === "string" ? params.highlight : undefined;
  const activeTab = typeof params.tab === "string" && params.tab === "spaces" ? "spaces" : "inventory";
  const itemTypeFilter = typeof params.itemType === "string" && (params.itemType === "consumable" || params.itemType === "equipment") ? params.itemType : undefined;
  const searchFilter = typeof params.search === "string" && params.search.length > 0 ? params.search : undefined;
  const categoryFilter = typeof params.category === "string" && params.category.length > 0 ? params.category : undefined;
  const sortParam = typeof params.sort === "string" ? params.sort : undefined;
  const cursorParam = typeof params.cursor === "string" && params.cursor.length > 0 ? params.cursor : undefined;

  const me = await mePromise;
  const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

  if (!household) {
    return (
      <>
        <header className="page-header"><h1>{t("pageTitle")}</h1></header>
        <div className="page-body">
          <p>{tCommon("empty.noHousehold")} <Link href="/" className="text-link">{tCommon("actions.goToDashboard")}</Link> to create one.</p>
        </div>
      </>
    );
  }

  const inventorySkeleton = (
    <>
      <div className="stats-row">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stat-card" aria-hidden="true">
            <SkeletonBlock variant="row" width="sm" />
            <div style={{ marginTop: 8 }}><SkeletonBlock variant="row" width="xs" /></div>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="panel__body">
          <table className="data-table" aria-hidden="true">
            <thead>
              <tr>
                <th>Item</th><th>Category</th><th>Stock</th><th>Reorder</th><th>Value</th><th></th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7].map((row) => (
                <tr key={row}>
                  <td><SkeletonBlock variant="row" width="lg" /></td>
                  <td><SkeletonBlock variant="pill" width="sm" /></td>
                  <td><SkeletonBlock variant="row" width="sm" /></td>
                  <td><SkeletonBlock variant="row" width="md" /></td>
                  <td><SkeletonBlock variant="row" width="sm" /></td>
                  <td><SkeletonBlock variant="button" width="xs" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );

  return (
    <Suspense fallback={
      <>
        <header className="page-header">
          <div><h1>{t("pageTitle")}</h1><p style={{ marginTop: 6 }}>{t("pageSubtitle")}</p></div>
        </header>
        <div className="page-body">{inventorySkeleton}</div>
      </>
    }>
      <InventoryContent
        householdId={household.id}
        highlightId={highlightId}
        activeTab={activeTab}
        itemTypeFilter={itemTypeFilter}
        searchFilter={searchFilter}
        categoryFilter={categoryFilter}
        sortParam={sortParam}
        cursor={cursorParam}
      />
    </Suspense>
  );
}

// ── Deferred inventory content ─────────────────────────────
type InventoryContentProps = {
  householdId: string;
  highlightId: string | undefined;
  activeTab: string;
  itemTypeFilter: string | undefined;
  searchFilter: string | undefined;
  categoryFilter: string | undefined;
  sortParam: string | undefined;
  cursor: string | undefined;
};

async function InventoryContent({
  householdId,
  highlightId,
  activeTab,
  itemTypeFilter,
  searchFilter,
  categoryFilter,
  sortParam,
  cursor,
}: InventoryContentProps): Promise<JSX.Element> {
  const [t, tCommon] = await Promise.all([
    getTranslations("inventory"),
    getTranslations("common"),
  ]);
  const isEquipmentView = itemTypeFilter === "equipment";
  const inventoryViewHref = buildInventoryHref(householdId, itemTypeFilter ? { itemType: itemTypeFilter } : undefined);
  const analyticsViewHref = `/analytics?tab=inventory&householdId=${householdId}`;
  const inventoryRedirectHref = `/inventory?householdId=${householdId}`;

  try {
    const [{ items, nextCursor }, lowStockItems, shoppingList, spaces] = await Promise.all([
      getHouseholdInventory(householdId, {
        limit: 50,
        ...(cursor ? { cursor } : {}),
        ...(itemTypeFilter ? { itemType: itemTypeFilter } : {}),
        ...(searchFilter ? { search: searchFilter } : {}),
        ...(categoryFilter ? { category: categoryFilter } : {}),
      }),
      getHouseholdLowStockInventory(householdId),
      getInventoryShoppingList(householdId),
      getHouseholdSpacesTree(householdId)
    ]);

    const highlightedItem = highlightId ? items.find((item) => item.id === highlightId) ?? null : null;
    let highlightedAnalytics = null;

    if (highlightedItem) {
      try {
        highlightedAnalytics = await getInventoryItemConsumption(householdId, highlightedItem.id);
      } catch (error) {
        if (!(error instanceof ApiError)) {
          throw error;
        }
      }
    }

    const categoryOptions = Array.from(new Set(
      items
        .map((item) => item.category?.trim())
        .filter((value): value is string => Boolean(value))
    )).sort((left, right) => left.localeCompare(right));

    const getStockStatus = (item: { quantityOnHand: number; reorderThreshold: number | null }): number => {
      if (item.quantityOnHand <= 0) return 0;
      if (item.reorderThreshold !== null && item.quantityOnHand <= item.reorderThreshold) return 1;
      return 2;
    };

    const sortedItems = [...items].sort((a, b) => {
      switch (sortParam) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "qty-asc": return a.quantityOnHand - b.quantityOnHand;
        case "qty-desc": return b.quantityOnHand - a.quantityOnHand;
        case "updated-desc": return b.updatedAt.localeCompare(a.updatedAt);
        case "status-asc": return getStockStatus(a) - getStockStatus(b);
        default: return 0;
      }
    });

    const groupedItems = Array.from(sortedItems.reduce((groups, item) => {
      const label = item.category?.trim() || "Uncategorized";
      const existingGroup = groups.get(label);

      if (existingGroup) {
        existingGroup.push(item);
      } else {
        groups.set(label, [item]);
      }

      return groups;
    }, new Map<string, typeof items>()).entries()).sort(([left], [right]) => {
      if (left === "Uncategorized") {
        return 1;
      }

      if (right === "Uncategorized") {
        return -1;
      }

      return left.localeCompare(right);
    });

    const categories = new Set(items.map((item) => item.category).filter(Boolean)).size;
    const outOfStockCount = items.filter((item) => item.quantityOnHand <= 0).length;

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const expiringItems = items.filter((item) => {
      if (!item.expiresAt) return false;
      const expiresMs = new Date(item.expiresAt).getTime();
      return expiresMs > now && expiresMs <= now + thirtyDaysMs;
    });
    const expiredItems = items.filter((item) => {
      if (!item.expiresAt) return false;
      return new Date(item.expiresAt).getTime() <= now;
    });

    return (
      <>
        <header className="page-header">
          <div>
            <h1>{t("pageTitle")}</h1>
            <p style={{ marginTop: 6 }}>{t("pageSubtitle")}</p>
          </div>
          <div className="page-header__actions">
            <InventoryValuationReportButton householdId={householdId} />
            <Link href="/inventory/trash" className="button button--ghost button--sm">Trash</Link>
            <Link href={inventoryViewHref} className="button button--primary button--sm">{t("inventoryButton")}</Link>
            <Link href={analyticsViewHref} className="button button--ghost button--sm">{t("analyticsHub")}</Link>
          </div>
        </header>

        <div className="page-body">
          {(outOfStockCount > 0 || expiredItems.length > 0 || expiringItems.length > 0) && (
            <div style={{ display: "grid", gap: 8, marginBottom: 4 }}>
              {outOfStockCount > 0 && (
                <Banner tone="danger" title={`${outOfStockCount} item${outOfStockCount === 1 ? "" : "s"} out of stock`}>
                  Review the reorder watchlist below to resupply.
                </Banner>
              )}
              {expiredItems.length > 0 && (
                <Banner tone="danger" title={`${expiredItems.length} item${expiredItems.length === 1 ? " has" : "s have"} expired`}>
                  {expiredItems.slice(0, 3).map((item) => item.name).join(", ")}{expiredItems.length > 3 ? ` and ${expiredItems.length - 3} more` : ""}.
                </Banner>
              )}
              {expiringItems.length > 0 && (
                <Banner tone="warning" title={`${expiringItems.length} item${expiringItems.length === 1 ? "" : "s"} expire within 30 days`}>
                  {expiringItems.slice(0, 3).map((item) => item.name).join(", ")}{expiringItems.length > 3 ? ` and ${expiringItems.length - 3} more` : ""}.
                </Banner>
              )}
            </div>
          )}
          <section className="stats-row">
            <div className="stat-card stat-card--accent">
              <span className="stat-card__label">Tracked Items</span>
              <strong className="stat-card__value">{items.length}</strong>
              <span className="stat-card__sub">Distinct parts and materials</span>
            </div>
            <div className="stat-card stat-card--warning">
              <span className="stat-card__label">Low Stock</span>
              <strong className="stat-card__value">{lowStockItems.length}</strong>
              <span className="stat-card__sub">At or below reorder threshold</span>
            </div>
            <div className="stat-card stat-card--danger">
              <span className="stat-card__label">Out of Stock</span>
              <strong className="stat-card__value">{outOfStockCount}</strong>
              <span className="stat-card__sub">Items with no stock on hand</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Categories</span>
              <strong className="stat-card__value">{categories}</strong>
              <span className="stat-card__sub">Ways the household inventory is organized</span>
            </div>
          </section>

          <TabNav
            items={[
              {
                id: "inventory",
                label: "Inventory",
                href: buildInventoryHref(householdId, {
                  ...(itemTypeFilter ? { itemType: itemTypeFilter } : {}),
                  tab: "inventory"
                }),
                active: activeTab === "inventory"
              },
              {
                id: "spaces",
                label: "Organization",
                href: buildInventoryHref(householdId, { tab: "spaces" }),
                active: activeTab === "spaces"
              }
            ]}
            variant="pill"
            ariaLabel="Inventory content tabs"
          />

          {activeTab === "inventory" ? (
            <>
              <InventoryFilterBar currentFilter={itemTypeFilter ?? "all"} categoryOptions={categoryOptions} />

              {!isEquipmentView ? (
                <>
                  <InventoryShoppingListSection householdId={householdId} shoppingList={shoppingList} redirectTo={inventoryRedirectHref} />
                  <InventoryQuickRestock
                    householdId={householdId}
                    items={items.filter((item) => item.itemType === "consumable")}
                    lowStockItemIds={lowStockItems.map((item) => item.id)}
                    redirectTo={inventoryRedirectHref}
                  />
                </>
              ) : null}

              {!isEquipmentView && (
              <section className="panel">
                <div className="panel__header">
                  <h2>{t("reorderWatchlist")}</h2>
                  <span className="data-table__secondary">{lowStockItems.length} items need attention</span>
                </div>
                <div className="panel__body">
                  {lowStockItems.length === 0 ? (
                    <p className="panel__empty">Nothing below reorder threshold.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Current Stock</th>
                          <th>Reorder Trigger</th>
                          <th>Supplier</th>
                          <th>Buy Link</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lowStockItems.map((item) => (
                          <tr key={item.id} className={["row--due", item.id === highlightId ? "row--highlight" : null].filter(Boolean).join(" ")}>
                            <td>
                              <div className="data-table__primary">
                                <Link href={buildInventoryItemHref(householdId, item.id)} className="data-table__link">{item.name}</Link>
                              </div>
                              <div className="data-table__secondary">
                                {item.partNumber ?? "No part number"}
                                {item.reorderQuantity !== null ? ` • ${formatRestockPlan(item.reorderQuantity, item.unit)}` : ""}
                              </div>
                            </td>
                            <td>{formatStockAmount(item.quantityOnHand, item.unit)}</td>
                            <td>{formatReorderPoint(item.reorderThreshold, item.unit)}</td>
                            <td>
                              <div className="data-table__primary">{item.preferredSupplier ?? "No supplier"}</div>
                              <div className="data-table__secondary">{formatCurrency(item.unitCost, "No unit cost")}</div>
                            </td>
                            <td>
                              {item.supplierUrl ? (
                                <a
                                  href={item.supplierUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="button button--ghost button--sm"
                                >
                                  Buy ↗
                                </a>
                              ) : (
                                <span className="data-table__secondary">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
              )}

              <InventoryListWorkspace
                householdId={householdId}
                totalCount={items.length}
                categoryOptions={categoryOptions}
                groupedItems={groupedItems.map(([label, groupedCategoryItems]) => ({
                  label,
                  items: groupedCategoryItems,
                }))}
                isEquipmentView={isEquipmentView}
                highlightId={highlightId}
                highlightedAnalytics={highlightedAnalytics}
                spaces={spaces}
              />

              {(cursor || nextCursor) && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
                  <span className="data-table__secondary">
                    {nextCursor ? `Showing ${items.length} items — more available` : `Showing ${items.length} items`}
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {cursor && (
                      <Link
                        href={buildInventoryHref(householdId, {
                          ...(itemTypeFilter ? { itemType: itemTypeFilter } : {}),
                          ...(searchFilter ? { search: searchFilter } : {}),
                          ...(categoryFilter ? { category: categoryFilter } : {}),
                          ...(sortParam ? { sort: sortParam } : {}),
                        })}
                        className="button button--ghost button--sm"
                      >
                        ← First page
                      </Link>
                    )}
                    {nextCursor && (
                      <Link
                        href={buildInventoryHref(householdId, {
                          ...(itemTypeFilter ? { itemType: itemTypeFilter } : {}),
                          ...(searchFilter ? { search: searchFilter } : {}),
                          ...(categoryFilter ? { category: categoryFilter } : {}),
                          ...(sortParam ? { sort: sortParam } : {}),
                          cursor: nextCursor,
                        })}
                        className="button button--ghost button--sm"
                      >
                        Next page →
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : <SpacesSection householdId={householdId} />}
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Inventory</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load inventory: {error.message}</p>
              </div>
            </div>
          </div>
        </>
      );
    }

    throw error;
  }
}