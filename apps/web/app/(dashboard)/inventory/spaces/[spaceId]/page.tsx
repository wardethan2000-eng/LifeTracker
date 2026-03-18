import Link from "next/link";
import type { JSX } from "react";
import { SpaceDetailActions } from "../../../../../components/space-detail-actions";
import { TabNav } from "../../../../../components/tab-nav";
import {
  ApiError,
  getHouseholdInventory,
  getHouseholdSpacesTree,
  getMe,
  getSpace
} from "../../../../../lib/api";
import { getSpaceTypeBadge, getSpaceTypeLabel } from "../../../../../lib/spaces";

type SpaceDetailPageProps = {
  params: Promise<{ spaceId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SpaceDetailPage({ params, searchParams }: SpaceDetailPageProps): Promise<JSX.Element> {
  const { spaceId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const householdId = typeof resolvedSearchParams.householdId === "string" ? resolvedSearchParams.householdId : undefined;
  const activeTab = typeof resolvedSearchParams.tab === "string" && resolvedSearchParams.tab === "subspaces" ? "subspaces" : "contents";

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

    const [space, spaces, { items: inventoryItems }] = await Promise.all([
      getSpace(household.id, spaceId),
      getHouseholdSpacesTree(household.id),
      getHouseholdInventory(household.id, { limit: 100 })
    ]);

    return (
      <>
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
            <Link href={`/inventory?householdId=${household.id}&tab=spaces`} className="button button--ghost button--sm">Back to Spaces</Link>
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
          ) : (
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