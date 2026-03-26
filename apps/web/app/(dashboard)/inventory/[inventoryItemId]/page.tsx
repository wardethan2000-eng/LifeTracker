import Link from "next/link";
import type { JSX } from "react";
import { AttachmentSection } from "../../../../components/attachment-section";
import { InventoryCommentsPanel } from "../../../../components/inventory-comments-panel";
import { InventoryDangerActions } from "../../../../components/inventory-danger-actions";
import { InventoryItemDetailEditor } from "../../../../components/inventory-item-detail-editor";
import { InventoryItemLocationsPanel } from "../../../../components/inventory-item-locations-panel";
import { QrCodeDialog } from "../../../../components/qr-code-dialog";
import { InventoryTransactionHistory } from "../../../../components/inventory-transaction-history";
import {
  ApiError,
  getHouseholdSpacesTree,
  getInventoryItemComments,
  getInventoryItemConsumption,
  getInventoryItemDetail,
  getMe
} from "../../../../lib/api";
import { formatCurrency, formatDate, formatDateTime } from "../../../../lib/formatters";

type InventoryItemDetailPageProps = {
  params: Promise<{ inventoryItemId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const formatStockAmount = (value: number, unit: string): string => {
  if (unit.trim().toLowerCase() === "each") {
    return `${value} item${value === 1 ? "" : "s"}`;
  }

  return `${value} ${unit}`;
};

const formatConditionLabel = (value: string | null): string => value
  ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  : "Not set";

const formatRevisionValue = (field: string, value: string | number | boolean | null): string => {
  if (value === null) {
    return "blank";
  }

  if (field === "unitCost" && typeof value === "number") {
    return formatCurrency(value, "blank");
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (field === "conditionStatus") {
    return formatConditionLabel(value);
  }

  if (field === "itemType") {
    return value === "equipment" ? "Equipment" : "Consumable";
  }

  return value;
};

export default async function InventoryItemDetailPage({ params, searchParams }: InventoryItemDetailPageProps): Promise<JSX.Element> {
  const { inventoryItemId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const householdId = typeof resolvedSearchParams.householdId === "string" ? resolvedSearchParams.householdId : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return (
        <>
          <header className="page-header"><h1>Inventory Item</h1></header>
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
          </div>
        </>
      );
    }

    const [item, analytics, comments, spaces] = await Promise.all([
      getInventoryItemDetail(household.id, inventoryItemId, { transactionLimit: 20 }),
      getInventoryItemConsumption(household.id, inventoryItemId),
      getInventoryItemComments(household.id, inventoryItemId),
      getHouseholdSpacesTree(household.id)
    ]);
    const backHref = `/inventory?householdId=${household.id}`;
    const linkedEntityCount = item.assets.length + item.projects.length + item.hobbyLinks.length;

    return (
      <>
        <header className="page-header">
          <div>
            <h1>{item.name}</h1>
            <p style={{ marginTop: 6 }}>
              {[item.category, item.partNumber, item.manufacturer].filter(Boolean).join(" • ") || "Inventory item detail"}
            </p>
          </div>
          <div className="page-header__actions">
            <QrCodeDialog
              dialogTitle={`${item.name} QR Code`}
              dialogDescription="Open the printable label, download the QR image, or copy the scan identifier for this inventory item."
              imageAlt={`QR code for ${item.name}`}
              svgPath={`/api/households/${household.id}/inventory/${item.id}/qr?format=svg&size=360`}
              pngPath={`/api/households/${household.id}/inventory/${item.id}/qr?format=png&size=720`}
              labelPath={`/api/households/${household.id}/inventory/${item.id}/label`}
              fileBaseName={`${item.name}-${item.partNumber ?? item.scanTag ?? item.id}`}
              codeLabel="Scan ID"
              codeValue={item.scanTag ?? item.partNumber ?? item.id}
              details={[item.name, ...(item.partNumber ? [`Part ${item.partNumber}`] : [])]}
              copyValue={item.scanTag ?? item.id}
            />
            <Link
              href={`/inventory/${item.id}/label?householdId=${household.id}`}
              className="button button--ghost button--sm"
            >
              Print Label
            </Link>
            <Link href={backHref} className="button button--ghost button--sm">← Inventory</Link>
          </div>
        </header>

        <div className="page-body">
          <section className="stats-row">
            <div className="stat-card stat-card--accent">
              <span className="stat-card__label">On Hand</span>
              <strong className="stat-card__value">{formatStockAmount(item.quantityOnHand, item.unit)}</strong>
              <span className="stat-card__sub">{item.lowStock ? "Below reorder threshold" : "Available for use"}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Average Consumption</span>
              <strong className="stat-card__value">{analytics.averageConsumptionPerMonth ? `${analytics.averageConsumptionPerMonth.toFixed(1)} / mo` : "—"}</strong>
              <span className="stat-card__sub">{analytics.consumeTransactionCount} consumption transactions logged</span>
            </div>
            <div className="stat-card stat-card--warning">
              <span className="stat-card__label">Projected Depletion</span>
              <strong className="stat-card__value">{analytics.projectedDepletionDate ? formatDate(analytics.projectedDepletionDate, "—") : "—"}</strong>
              <span className="stat-card__sub">Average unit cost {formatCurrency(analytics.averageUnitCost, "—")}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Linked Work</span>
              <strong className="stat-card__value">{linkedEntityCount}</strong>
              <span className="stat-card__sub">Assets, projects, and hobbies referencing this item</span>
            </div>
          </section>

          <div style={{ display: "grid", gap: 24, gridTemplateColumns: "minmax(0, 2fr) minmax(300px, 1fr)" }}>
            <section className="panel">
              <div className="panel__header">
                <h2>Edit Inventory Item</h2>
              </div>
              <div className="panel__body--padded">
                <InventoryItemDetailEditor householdId={household.id} item={item} />
              </div>
            </section>

            <aside style={{ display: "grid", gap: 24, alignContent: "start" }}>
              <section className="panel">
                <div className="panel__header">
                  <h2>Snapshot</h2>
                </div>
                <div className="panel__body--padded">
                  <dl className="data-list">
                    <div><dt>Item Type</dt><dd>{item.itemType === "equipment" ? "Equipment" : "Consumable"}</dd></div>
                    <div><dt>Condition</dt><dd>{formatConditionLabel(item.conditionStatus)}</dd></div>
                    <div><dt>Storage Location</dt><dd>{item.storageLocation ?? "Not recorded"}</dd></div>
                    <div><dt>Preferred Supplier</dt><dd>{item.preferredSupplier ?? "Not recorded"}</dd></div>
                    <div><dt>Supplier Link</dt><dd>{item.supplierUrl ? <a href={item.supplierUrl} className="text-link" target="_blank" rel="noreferrer">Open supplier page</a> : "Not recorded"}</dd></div>
                    <div><dt>Expiration Date</dt><dd>{item.expiresAt ? formatDate(item.expiresAt, "Not set") : "Not set"}</dd></div>
                    <div><dt>Created</dt><dd>{formatDateTime(item.createdAt, "—")}</dd></div>
                    <div><dt>Last Updated</dt><dd>{formatDateTime(item.updatedAt, "—")}</dd></div>
                  </dl>
                </div>
              </section>

              {item.partNumber && (
                <section className="panel">
                  <div className="panel__header">
                    <h2>Barcode</h2>
                  </div>
                  <div className="panel__body--padded">
                    <figure className="barcode-panel__preview">
                      <img
                        src={`/api/v1/barcode/image?value=${encodeURIComponent(item.partNumber)}&output=png`}
                        alt={`Barcode for ${item.partNumber}`}
                        className="barcode-panel__image"
                      />
                      <figcaption className="barcode-panel__caption">{item.partNumber}</figcaption>
                    </figure>
                    <a
                      href={`/api/households/${household.id}/inventory/barcode-labels?itemIds=${item.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="button button--secondary button--sm"
                    >
                      Print Barcode Label
                    </a>
                  </div>
                </section>
              )}

              <section className="panel">
                <div className="panel__header">
                  <h2>Linked Assets</h2>
                </div>
                <div className="panel__body">
                  {item.assets.length === 0 ? (
                    <p className="panel__empty">No asset links yet.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Asset</th>
                          <th>Recommended Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.assets.map((link) => (
                          <tr key={link.id}>
                            <td><Link href={`/assets/${link.asset.id}`} className="data-table__link">{link.asset.name}</Link></td>
                            <td>{link.recommendedQuantity ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              <InventoryItemLocationsPanel householdId={household.id} item={item} spaces={spaces} />

              <section className="panel">
                <div className="panel__header">
                  <h2>Danger Zone</h2>
                </div>
                <div className="panel__body--padded">
                  <InventoryDangerActions householdId={household.id} inventoryItemId={item.id} redirectTo={backHref} />
                </div>
              </section>
            </aside>
          </div>

          <section className="panel">
            <div className="panel__header">
              <h2>Linked Projects</h2>
            </div>
            <div className="panel__body">
              {item.projects.length === 0 ? (
                <p className="panel__empty">No project allocations yet.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Needed</th>
                      <th>Allocated</th>
                      <th>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.projects.map((link) => (
                      <tr key={link.id}>
                        <td><Link href={`/projects/${link.project.id}?householdId=${household.id}`} className="data-table__link">{link.project.name}</Link></td>
                        <td>{link.quantityNeeded}</td>
                        <td>{link.quantityAllocated}</td>
                        <td>{link.quantityRemaining}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Linked Hobbies</h2>
            </div>
            <div className="panel__body">
              {item.hobbyLinks.length === 0 ? (
                <p className="panel__empty">No hobby links yet.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Hobby</th>
                      <th>Status</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.hobbyLinks.map((link) => (
                      <tr key={link.id}>
                        <td><Link href={`/hobbies/${link.hobbyId}`} className="data-table__link">{link.hobbyName}</Link></td>
                        <td>{link.hobbyStatus}</td>
                        <td>{link.role ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <AttachmentSection
            householdId={household.id}
            entityType="inventory_item"
            entityId={item.id}
          />

          <InventoryCommentsPanel
            householdId={household.id}
            inventoryItemId={item.id}
            comments={comments}
          />

          <section className="panel">
            <div className="panel__header">
              <h2>Metadata History</h2>
              <span className="pill">{item.revisions.length}</span>
            </div>
            <div className="panel__body">
              {item.revisions.length === 0 ? (
                <p className="panel__empty">No metadata changes recorded yet.</p>
              ) : (
                <div className="schedule-stack">
                  {item.revisions.map((revision) => (
                    <article key={revision.id} className="schedule-card">
                      <div className="schedule-card__summary">
                        <div>
                          <h3>{revision.user.displayName ?? "Household member"}</h3>
                          <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                            {formatDateTime(revision.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: "grid", gap: 10 }}>
                        {revision.changes.map((change) => (
                          <div key={`${revision.id}-${change.field}`} style={{ display: "grid", gap: 4 }}>
                            <strong>{change.label}</strong>
                            <div style={{ color: "var(--ink-muted)", fontSize: "0.92rem" }}>
                              {formatRevisionValue(change.field, change.previousValue)}
                              {" → "}
                              {formatRevisionValue(change.field, change.nextValue)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <InventoryTransactionHistory householdId={household.id} inventoryItemId={item.id} title="Item Transaction History" />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Inventory Item</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load inventory item: {error.message}</p>
              </div>
            </div>
          </div>
        </>
      );
    }

    throw error;
  }
}