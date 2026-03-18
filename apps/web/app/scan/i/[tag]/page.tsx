import Link from "next/link";
import type { JSX } from "react";
import { notFound } from "next/navigation";
import { ApiError, getScanInventoryItemDetail, resolveScanTag } from "../../../../lib/api";
import { formatSpaceBreadcrumb, getSpaceTypeLabel } from "../../../../lib/spaces";

type InventoryItemScanPageProps = {
  params: Promise<{ tag: string }>;
};

export default async function InventoryItemScanPage({ params }: InventoryItemScanPageProps): Promise<JSX.Element> {
  const { tag } = await params;

  try {
    const resolved = await resolveScanTag(tag);

    if (resolved.type !== "inventory_item") {
      notFound();
    }

    let detail = null;

    try {
      detail = await getScanInventoryItemDetail(tag, { transactionLimit: 10 });
    } catch (error) {
      if (!(error instanceof ApiError) || ![401, 403].includes(error.status)) {
        throw error;
      }
    }

    return (
      <div className="page-body" style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 24, paddingTop: 32, paddingBottom: 40 }}>
        <header className="panel">
          <div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="pill">Inventory Item</span>
              {resolved.partNumber ? <span className="pill">Part {resolved.partNumber}</span> : null}
            </div>
            <div>
              <h1 style={{ margin: 0 }}>{resolved.name}</h1>
              <p style={{ margin: "6px 0 0", color: "var(--ink-muted)" }}>
                {detail
                  ? [detail.category, detail.partNumber, `${detail.quantityOnHand} ${detail.unit} on hand`].filter(Boolean).join(" • ")
                  : resolved.partNumber ?? "Sign in to see where this item belongs."}
              </p>
            </div>
          </div>
        </header>

        {detail ? (
          <section className="panel">
            <div className="panel__header">
              <h2>Locations</h2>
            </div>
            <div className="panel__body">
              {detail.spaceLinks.length === 0 ? (
                <p className="panel__empty">This item is not assigned to any spaces yet.</p>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {detail.spaceLinks.map((link) => (
                    <Link key={link.id} href={`/scan/s/${encodeURIComponent(link.space.scanTag)}`} style={{ textDecoration: "none", color: "inherit" }}>
                      <article style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, display: "grid", gap: 8, background: "var(--surface)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <span className="pill">{getSpaceTypeLabel(link.space.type)}</span>
                              <strong>{link.space.name}</strong>
                              <span className="pill">{link.space.shortCode}</span>
                            </div>
                            <span className="data-table__secondary">{formatSpaceBreadcrumb(link.space)}</span>
                          </div>
                          <strong>{link.quantity ?? "Not specified"}</strong>
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="panel">
            <div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>
              <h2 style={{ margin: 0 }}>Sign in to view locations</h2>
              <p style={{ margin: 0, color: "var(--ink-muted)" }}>
                This scan resolved the inventory item, but its exact storage locations are only available to signed-in household members.
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