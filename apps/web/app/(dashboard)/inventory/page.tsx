import Link from "next/link";
import type { JSX } from "react";
import { getTranslations } from "next-intl/server";
import { InventoryFilterBar } from "../../../components/inventory-filter-bar";
import { InventoryListWorkspace } from "../../../components/inventory-list-workspace";
import { InventoryQuickRestock } from "../../../components/inventory-quick-restock";
import { RealtimeRefreshBoundary } from "../../../components/realtime-refresh-boundary";
import { InventoryValuationReportButton } from "../../../components/report-download-actions";
import { InventoryShoppingListSection } from "../../../components/inventory-shopping-list-section";
import { InventoryTransactionHistory } from "../../../components/inventory-transaction-history";
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
  const t = await getTranslations("inventory");
  const tCommon = await getTranslations("common");
  const params = searchParams ? await searchParams : {};
  const householdId = typeof params.householdId === "string" ? params.householdId : undefined;
  const highlightId = typeof params.highlight === "string" ? params.highlight : undefined;
  const activeTab = typeof params.tab === "string" && params.tab === "spaces" ? "spaces" : "inventory";
  const itemTypeFilter = typeof params.itemType === "string" && (params.itemType === "consumable" || params.itemType === "equipment") ? params.itemType : undefined;
  const isEquipmentView = itemTypeFilter === "equipment";

  try {
    const me = await getMe();
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

    const inventoryViewHref = buildInventoryHref(household.id, itemTypeFilter ? { itemType: itemTypeFilter } : undefined);
    const analyticsViewHref = `/analytics?tab=inventory&householdId=${household.id}`;
    const inventoryRedirectHref = `/inventory?householdId=${household.id}`;

    const [{ items }, lowStockItems, shoppingList, spaces] = await Promise.all([
      getHouseholdInventory(household.id, { limit: 100, ...(itemTypeFilter ? { itemType: itemTypeFilter } : {}) }),
      getHouseholdLowStockInventory(household.id),
      getInventoryShoppingList(household.id),
      getHouseholdSpacesTree(household.id)
    ]);

    const highlightedItem = highlightId ? items.find((item) => item.id === highlightId) ?? null : null;
    let highlightedAnalytics = null;

    if (highlightedItem) {
      try {
        highlightedAnalytics = await getInventoryItemConsumption(household.id, highlightedItem.id);
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

    const groupedItems = Array.from(items.reduce((groups, item) => {
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

    return (
      <>
        <RealtimeRefreshBoundary householdId={household.id} eventTypes={["inventory.changed"]} />
        <header className="page-header">
          <div>
            <h1>{t("pageTitle")}</h1>
            <p style={{ marginTop: 6 }}>{t("pageSubtitle")}</p>
          </div>
          <div className="page-header__actions">
            <InventoryValuationReportButton householdId={household.id} />
            <Link href={inventoryViewHref} className="button button--primary button--sm">{t("inventoryButton")}</Link>
            <Link href={analyticsViewHref} className="button button--ghost button--sm">{t("analyticsHub")}</Link>
          </div>
        </header>

        <div className="page-body">
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
              <span className="stat-card__sub">Items with nothing currently on hand</span>
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
                href: buildInventoryHref(household.id, {
                  ...(itemTypeFilter ? { itemType: itemTypeFilter } : {}),
                  tab: "inventory"
                }),
                active: activeTab === "inventory"
              },
              {
                id: "spaces",
                label: "Organization",
                href: buildInventoryHref(household.id, { tab: "spaces" }),
                active: activeTab === "spaces"
              }
            ]}
            variant="pill"
            ariaLabel="Inventory content tabs"
          />

          {activeTab === "inventory" ? (
            <>
              <InventoryFilterBar currentFilter={itemTypeFilter ?? "all"} />

              {!isEquipmentView ? (
                <>
                  <InventoryShoppingListSection householdId={household.id} shoppingList={shoppingList} redirectTo={inventoryRedirectHref} />
                  <InventoryQuickRestock
                    householdId={household.id}
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
                    <p className="panel__empty">Nothing is currently below its reorder threshold.</p>
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
                                <Link href={buildInventoryItemHref(household.id, item.id)} className="data-table__link">{item.name}</Link>
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
                            <td>{item.supplierUrl ? "Saved link" : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
              )}

              <InventoryListWorkspace
                householdId={household.id}
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

              <InventoryTransactionHistory householdId={household.id} />
            </>
          ) : <SpacesSection householdId={household.id} />}
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