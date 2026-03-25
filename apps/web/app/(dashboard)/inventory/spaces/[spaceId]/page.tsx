import Link from "next/link";
import type { JSX } from "react";
import { SpaceDetailActions } from "../../../../../components/space-detail-actions";
import { SpaceQuickPlace } from "../../../../../components/space-quick-place";
import { SpaceViewLogger } from "../../../../../components/space-view-logger";
import { TabNav } from "../../../../../components/tab-nav";
import {
  ApiError,
  getHouseholdInventory,
  getHouseholdSpacesTree,
  getMe,
  getSpaceHistory,
  getSpace
} from "../../../../../lib/api";
import { getSpaceTypeBadge, getSpaceTypeLabel } from "../../../../../lib/spaces";

const HISTORY_ACTION_LABELS = {
  placed: "Placed",
  removed: "Removed",
  moved_in: "Moved In",
  moved_out: "Moved Out",
  quantity_changed: "Quantity Changed"
} as const;

const HISTORY_ACTION_MARKERS = {
  placed: "+",
  removed: "-",
  moved_in: ">",
  moved_out: "<",
  quantity_changed: "~"
} as const;

const formatHistoryDateTime = (value: string): string => new Date(value).toLocaleString(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

const formatHistoryQuantity = (quantity: number | null): string => quantity === null ? "Unspecified" : String(quantity);

type SpaceDetailPageProps = {
  params: Promise<{ spaceId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SpaceDetailPage({ params, searchParams }: SpaceDetailPageProps): Promise<JSX.Element> {
  const { spaceId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const householdId = typeof resolvedSearchParams.householdId === "string" ? resolvedSearchParams.householdId : undefined;
  const activeTab = typeof resolvedSearchParams.tab === "string"
    && ["contents", "subspaces", "history"].includes(resolvedSearchParams.tab)
    ? resolvedSearchParams.tab as "contents" | "subspaces" | "history"
    : "contents";
  const historyAction = typeof resolvedSearchParams.historyAction === "string" && resolvedSearchParams.historyAction.length > 0
    ? resolvedSearchParams.historyAction
    : "";
  const historySince = typeof resolvedSearchParams.historySince === "string" ? resolvedSearchParams.historySince : "";
  const historyUntil = typeof resolvedSearchParams.historyUntil === "string" ? resolvedSearchParams.historyUntil : "";
  const historyCursor = typeof resolvedSearchParams.historyCursor === "string" ? resolvedSearchParams.historyCursor : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return (
        <>
          <header className="page-header"><h1>Space</h1></header>
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
          </div>
        </>
      );
    }

    const [space, spaces, { items: inventoryItems }, history] = await Promise.all([
      getSpace(household.id, spaceId),
      getHouseholdSpacesTree(household.id),
      getHouseholdInventory(household.id, { limit: 100 }),
      activeTab === "history"
        ? getSpaceHistory(household.id, spaceId, {
            ...(historyAction ? { actions: [historyAction as keyof typeof HISTORY_ACTION_LABELS] } : {}),
            ...(historySince ? { since: new Date(`${historySince}T00:00:00`).toISOString() } : {}),
            ...(historyUntil ? { until: new Date(`${historyUntil}T23:59:59`).toISOString() } : {}),
            ...(historyCursor ? { cursor: historyCursor } : {}),
            limit: 25
          })
        : Promise.resolve(null)
    ]);

    return (
      <>
        <SpaceViewLogger householdId={household.id} spaceId={space.id} />
        <header className="page-header">
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="pill">{getSpaceTypeBadge(space.type)}</span>
              <h1>{space.name}</h1>
              <span className="pill">{space.shortCode}</span>
            </div>
            <nav aria-label="Space breadcrumb" style={{ display: "flex", gap: 8, flexWrap: "wrap", color: "var(--ink-muted)" }}>
              {space.breadcrumb.map((segment, index) => {
                const isCurrent = index === space.breadcrumb.length - 1;

                return (
                  <span key={segment.id} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    {isCurrent ? (
                      <strong>{segment.name}</strong>
                    ) : (
                      <Link href={`/inventory/spaces/${segment.id}?householdId=${household.id}`} className="text-link">{segment.name}</Link>
                    )}
                    {!isCurrent ? <span>/</span> : null}
                  </span>
                );
              })}
            </nav>
            <p style={{ margin: 0, color: "var(--ink-muted)" }}>
              {getSpaceTypeLabel(space.type)}
              {space.description ? ` • ${space.description}` : ""}
            </p>
          </div>
          <div className="page-header__actions">
            <SpaceQuickPlace householdId={household.id} spaces={spaces} initialSpaceId={space.id} triggerLabel="Quick Place Items" triggerClassName="button button--primary button--sm" />
            <Link href={`/inventory?householdId=${household.id}&tab=spaces`} className="button button--ghost button--sm">← Spaces</Link>
          </div>
        </header>

        <div className="page-body">
          <div style={{ display: "grid", gap: 24, gridTemplateColumns: "minmax(0, 2fr) minmax(300px, 1fr)" }}>
            <section className="panel">
              <div className="panel__header">
                <h2>Overview</h2>
              </div>
              <div className="panel__body--padded">
                <dl className="data-list">
                  <div><dt>Type</dt><dd>{getSpaceTypeLabel(space.type)}</dd></div>
                  <div><dt>Short Code</dt><dd>{space.shortCode}</dd></div>
                  <div><dt>Scan Tag</dt><dd>{space.scanTag}</dd></div>
                  <div><dt>Description</dt><dd>{space.description ?? "No description recorded"}</dd></div>
                  <div><dt>Notes</dt><dd>{space.notes ?? "No notes recorded"}</dd></div>
                </dl>
              </div>
            </section>

            <SpaceDetailActions householdId={household.id} space={space} spaces={spaces} inventoryItems={inventoryItems} />
          </div>

          <TabNav
            ariaLabel="Space detail tabs"
            variant="pill"
            items={[
              {
                id: "contents",
                label: "Contents",
                href: `/inventory/spaces/${space.id}?householdId=${household.id}&tab=contents`,
                active: activeTab === "contents"
              },
              {
                id: "subspaces",
                label: "Sub-Spaces",
                href: `/inventory/spaces/${space.id}?householdId=${household.id}&tab=subspaces`,
                active: activeTab === "subspaces"
              },
              {
                id: "history",
                label: "History",
                href: `/inventory/spaces/${space.id}?householdId=${household.id}&tab=history`,
                active: activeTab === "history"
              }
            ]}
          />

          {activeTab === "contents" ? (
            <>
              <section className="panel">
                <div className="panel__header">
                  <h2>Inventory Items</h2>
                </div>
                <div className="panel__body">
                  {(space.spaceItems?.length ?? 0) === 0 ? (
                    <p className="panel__empty">No tracked inventory items are assigned to this space yet.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Category</th>
                          <th>Quantity in Space</th>
                          <th>On Hand</th>
                        </tr>
                      </thead>
                      <tbody>
                        {space.spaceItems?.map((link) => (
                          <tr key={link.id}>
                            <td><Link href={`/inventory/${link.inventoryItem.id}?householdId=${household.id}`} className="data-table__link">{link.inventoryItem.name}</Link></td>
                            <td>{link.inventoryItem.category ?? "—"}</td>
                            <td>{link.quantity ?? "—"}</td>
                            <td>{link.inventoryItem.quantityOnHand}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <h2>General Items</h2>
                </div>
                <div className="panel__body">
                  {(space.generalItems?.length ?? 0) === 0 ? (
                    <p className="panel__empty">No free-text items are listed in this space yet.</p>
                  ) : (
                    <div className="schedule-stack">
                      {space.generalItems?.map((item) => (
                        <article key={item.id} className="schedule-card">
                          <div className="schedule-card__summary">
                            <div>
                              <h3>{item.name}</h3>
                              <p style={{ color: "var(--ink-muted)", marginTop: 6 }}>{item.description ?? item.notes ?? "General household item"}</p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : activeTab === "subspaces" ? (
            <section className="panel">
              <div className="panel__header">
                <h2>Child Spaces</h2>
              </div>
              <div className="panel__body">
                {(space.children?.length ?? 0) === 0 ? (
                  <p className="panel__empty">This space does not have any sub-spaces yet.</p>
                ) : (
                  <div className="schedule-stack">
                    {space.children?.map((child) => (
                      <article key={child.id} className="schedule-card">
                        <div className="schedule-card__summary">
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <span className="pill">{getSpaceTypeBadge(child.type)}</span>
                              <Link href={`/inventory/spaces/${child.id}?householdId=${household.id}`} className="data-table__link">{child.name}</Link>
                              <span className="pill">{child.shortCode}</span>
                            </div>
                            <div className="data-table__secondary">{child.totalItemCount ?? 0} items</div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="panel">
              <div className="panel__header">
                <h2>History</h2>
              </div>
              <div className="panel__body--padded" style={{ display: "grid", gap: 18 }}>
                <form method="get" style={{ display: "grid", gap: 14 }}>
                  <input type="hidden" name="householdId" value={household.id} />
                  <input type="hidden" name="tab" value="history" />
                  <div className="form-grid">
                    <label className="field">
                      <span>Action</span>
                      <select name="historyAction" defaultValue={historyAction}>
                        <option value="">All actions</option>
                        {Object.entries(HISTORY_ACTION_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>From</span>
                      <input type="date" name="historySince" defaultValue={historySince} />
                    </label>
                    <label className="field">
                      <span>To</span>
                      <input type="date" name="historyUntil" defaultValue={historyUntil} />
                    </label>
                  </div>
                  <div className="inline-actions">
                    <button type="submit" className="button button--primary button--sm">Apply Filters</button>
                    <Link href={`/inventory/spaces/${space.id}?householdId=${household.id}&tab=history`} className="button button--ghost button--sm">Clear</Link>
                  </div>
                </form>

                {!history || history.items.length === 0 ? (
                  <p className="panel__empty">No history matched the current filters.</p>
                ) : (
                  <div className="schedule-stack">
                    {history.items.map((entry) => (
                      <article key={entry.id} className="schedule-card">
                        <div className="schedule-card__summary">
                          <div style={{ display: "grid", gap: 8, width: "100%" }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <span className="pill">{HISTORY_ACTION_MARKERS[entry.action]}</span>
                              <span className="status-chip status-chip--clear">{HISTORY_ACTION_LABELS[entry.action]}</span>
                              <span className="data-table__secondary">{formatHistoryDateTime(entry.createdAt)}</span>
                            </div>
                            <div style={{ display: "grid", gap: 6 }}>
                              <div>
                                {entry.entityUrl && !entry.itemDeleted ? (
                                  <Link href={entry.entityUrl} className="data-table__link">{entry.itemName}</Link>
                                ) : (
                                  <strong>{entry.itemName}</strong>
                                )}
                              </div>
                              <div className="data-table__secondary">
                                {entry.action === "quantity_changed"
                                  ? `Quantity changed from ${formatHistoryQuantity(entry.previousQuantity)} to ${formatHistoryQuantity(entry.quantity)}.`
                                  : entry.quantity !== null
                                    ? `Quantity: ${formatHistoryQuantity(entry.quantity)}.`
                                    : "Quantity not specified."}
                              </div>
                              <div className="data-table__secondary">
                                {entry.space.breadcrumb.map((segment) => segment.name).join(" / ")}
                              </div>
                              <div className="data-table__secondary">
                                {entry.actor?.displayName ? `By ${entry.actor.displayName}` : entry.performedBy ? "By household member" : "System recorded"}
                              </div>
                              {entry.notes ? <div className="data-table__secondary">Notes: {entry.notes}</div> : null}
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {history?.nextCursor ? (
                  <div className="inline-actions">
                    <Link
                      href={`/inventory/spaces/${space.id}?householdId=${household.id}&tab=history${historyAction ? `&historyAction=${encodeURIComponent(historyAction)}` : ""}${historySince ? `&historySince=${encodeURIComponent(historySince)}` : ""}${historyUntil ? `&historyUntil=${encodeURIComponent(historyUntil)}` : ""}&historyCursor=${history.nextCursor}`}
                      className="button button--ghost button--sm"
                    >
                      Load More History
                    </Link>
                  </div>
                ) : null}
              </div>
            </section>
          )}
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Space</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load space: {error.message}</p>
              </div>
            </div>
          </div>
        </>
      );
    }

    throw error;
  }
}