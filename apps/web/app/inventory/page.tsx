import Link from "next/link";
import type { JSX } from "react";
import { AppShell } from "../../components/app-shell";
import { InventorySection } from "../../components/inventory-section";
import {
  ApiError,
  getHouseholdInventory,
  getHouseholdLowStockInventory,
  getMe
} from "../../lib/api";
import { formatCurrency } from "../../lib/formatters";

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

export default async function InventoryPage({ searchParams }: InventoryPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};
  const householdId = typeof params.householdId === "string" ? params.householdId : undefined;
  const highlightId = typeof params.highlight === "string" ? params.highlight : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return (
        <AppShell activePath="/inventory">
          <header className="page-header"><h1>Inventory</h1></header>
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
          </div>
        </AppShell>
      );
    }

    const [{ items }, lowStockItems] = await Promise.all([
      getHouseholdInventory(household.id, { limit: 100 }),
      getHouseholdLowStockInventory(household.id)
    ]);

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
      <AppShell activePath="/inventory">
        <header className="page-header">
          <div>
            <h1>Inventory</h1>
            <p style={{ marginTop: 6 }}>Universal household stock across assets, projects, and standalone supplies.</p>
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

          <section className="panel">
            <div className="panel__header">
              <h2>Reorder Watchlist</h2>
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
                          <div className="data-table__primary">{item.name}</div>
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

          <InventorySection householdId={household.id} totalCount={items.length} categoryOptions={categoryOptions}>
            {items.length === 0 ? (
              <p className="panel__empty">No inventory items found for this household yet.</p>
            ) : (
              <div className="inventory-groups">
                {groupedItems.map(([categoryLabel, categoryItems]) => (
                  <section key={categoryLabel} className="inventory-group">
                    <div className="inventory-group__header">
                      <div>
                        <h3>{categoryLabel}</h3>
                        <p>{categoryItems.length} item{categoryItems.length === 1 ? "" : "s"} in this category</p>
                      </div>
                    </div>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>On Hand</th>
                          <th>Reorder Rule</th>
                          <th>Last Price</th>
                          <th>Supplier</th>
                          <th>Status</th>
                          <th>Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryItems.map((item) => (
                          <tr key={item.id} className={[item.lowStock ? "row--due" : null, item.id === highlightId ? "row--highlight" : null].filter(Boolean).join(" ") || undefined}>
                            <td>
                              <div className="data-table__primary">{item.name}</div>
                              <div className="data-table__secondary">
                                {[item.partNumber, item.manufacturer].filter(Boolean).join(" • ") || "No part number or maker recorded"}
                              </div>
                            </td>
                            <td>{formatStockAmount(item.quantityOnHand, item.unit)}</td>
                            <td>
                              <div className="data-table__primary">{formatReorderPoint(item.reorderThreshold, item.unit)}</div>
                              <div className="data-table__secondary">{formatRestockPlan(item.reorderQuantity, item.unit)}</div>
                            </td>
                            <td>{formatCurrency(item.unitCost, "No recent price")}</td>
                            <td>{item.preferredSupplier ?? "—"}</td>
                            <td>
                              <span className={`status-chip status-chip--${item.lowStock ? "due" : "upcoming"}`}>
                                {item.lowStock ? "Needs reorder" : "OK"}
                              </span>
                            </td>
                            <td>{item.storageLocation ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                ))}
              </div>
            )}
          </InventorySection>
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <AppShell activePath="/inventory">
          <header className="page-header"><h1>Inventory</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load inventory: {error.message}</p>
              </div>
            </div>
          </div>
        </AppShell>
      );
    }

    throw error;
  }
}