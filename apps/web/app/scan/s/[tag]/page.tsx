import Link from "next/link";
import type { JSX } from "react";
import { notFound } from "next/navigation";
import { ApiError, getScanSpaceDetail, getScanSpaceSummary } from "../../../../lib/api";
import { getSpaceTypeLabel } from "../../../../lib/spaces";

type SpaceScanPageProps = {
  params: Promise<{ tag: string }>;
};

export default async function SpaceScanPage({ params }: SpaceScanPageProps): Promise<JSX.Element> {
  const { tag } = await params;

  try {
    const summary = await getScanSpaceSummary(tag);
    let detail = null;

    try {
      detail = await getScanSpaceDetail(tag);
    } catch (error) {
      if (!(error instanceof ApiError) || ![401, 403].includes(error.status)) {
        throw error;
      }
    }

    const headline = detail ?? summary;
    const parentTrail = headline.breadcrumb.slice(0, -1);

    return (
      <div className="page-body" style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 24, paddingTop: 32, paddingBottom: 40 }}>
        <header className="panel" style={{ overflow: "hidden" }}>
          <div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="pill">{getSpaceTypeLabel(headline.type)}</span>
              <span className="pill">{summary.shortCode}</span>
            </div>
            <div>
              <h1 style={{ margin: 0 }}>{headline.name}</h1>
              <p style={{ margin: "6px 0 0", color: "var(--ink-muted)" }}>{headline.breadcrumb.map((segment) => segment.name).join(" / ")}</p>
            </div>
          </div>
        </header>

        {detail ? (
          <>
            <section className="panel">
              <div className="panel__header">
                <h2>Contents</h2>
              </div>
              <div className="panel__body">
                {(detail.spaceItems?.length ?? 0) === 0 && (detail.generalItems?.length ?? 0) === 0 ? (
                  <p className="panel__empty">No contents are assigned to this space yet.</p>
                ) : (
                  <div style={{ display: "grid", gap: 18 }}>
                    <div>
                      <h3 style={{ margin: "0 0 10px" }}>Inventory Items</h3>
                      {(detail.spaceItems?.length ?? 0) === 0 ? (
                        <p className="panel__empty">No tracked inventory items in this space.</p>
                      ) : (
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th>Quantity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.spaceItems?.map((link) => (
                              <tr key={link.id}>
                                <td>{link.inventoryItem.name}</td>
                                <td>{link.quantity ?? "Not specified"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    <div>
                      <h3 style={{ margin: "0 0 10px" }}>General Items</h3>
                      {(detail.generalItems?.length ?? 0) === 0 ? (
                        <p className="panel__empty">No free-text items listed here.</p>
                      ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                          {detail.generalItems?.map((generalItem) => (
                            <article key={generalItem.id} style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 12 }}>
                              <strong>{generalItem.name}</strong>
                              <p style={{ margin: "6px 0 0", color: "var(--ink-muted)" }}>{generalItem.description ?? generalItem.notes ?? "General household item"}</p>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel__header">
                <h2>Sub-Spaces</h2>
              </div>
              <div className="panel__body">
                {(detail.children?.length ?? 0) === 0 ? (
                  <p className="panel__empty">This space does not contain any sub-spaces.</p>
                ) : (
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                    {detail.children?.map((child) => (
                      <Link key={child.id} href={`/scan/s/${encodeURIComponent(child.scanTag)}`} className="card-link" style={{ textDecoration: "none", color: "inherit" }}>
                        <article style={{ height: "100%", padding: 16, border: "1px solid var(--border)", borderRadius: 14, display: "grid", gap: 8, background: "var(--surface)" }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span className="pill">{getSpaceTypeLabel(child.type)}</span>
                            <span className="pill">{child.shortCode}</span>
                          </div>
                          <strong>{child.name}</strong>
                          <span className="data-table__secondary">{child.totalItemCount ?? 0} items</span>
                        </article>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel__header">
                <h2>Located In</h2>
              </div>
              <div className="panel__body">
                {parentTrail.length === 0 ? (
                  <p className="panel__empty">This is a top-level space.</p>
                ) : (
                  <nav aria-label="Parent spaces" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {parentTrail.map((segment, index) => (
                      <span key={segment.id} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                        <span>{segment.name}</span>
                        {index < parentTrail.length - 1 ? <span>/</span> : null}
                      </span>
                    ))}
                  </nav>
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="panel">
            <div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>
              <h2 style={{ margin: 0 }}>Full contents require sign-in</h2>
              <p style={{ margin: 0, color: "var(--ink-muted)" }}>
                This scan resolved the space successfully, but detailed contents and sub-space information are only available to signed-in household members.
              </p>
              <div>
                <Link href="/inventory" className="button button--primary button--sm">Open dashboard</Link>
              </div>
            </div>
          </section>
        )}
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}