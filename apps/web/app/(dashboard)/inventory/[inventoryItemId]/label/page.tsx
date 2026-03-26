import type { JSX } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssetLabelPrintToolbar } from "../../../../../components/asset-label-print-toolbar";
import { ApiError, getInventoryItemDetail, getMe } from "../../../../../lib/api";

type InventoryItemLabelPageProps = {
  params: Promise<{ inventoryItemId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryItemLabelPage({ params, searchParams }: InventoryItemLabelPageProps): Promise<JSX.Element> {
  const { inventoryItemId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const householdIdParam = typeof resolvedSearchParams.householdId === "string" ? resolvedSearchParams.householdId : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((h) => h.id === householdIdParam) ?? me.households[0];
    if (!household) notFound();

    const item = await getInventoryItemDetail(household.id, inventoryItemId);

    const categoryDisplay = item.category
      ? item.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : null;

    return (
      <main className="print-label-page">
        <header className="print-label-toolbar print-hidden">
          <div>
            <p className="eyebrow">Inventory Label</p>
            <h1>{item.name}</h1>
            <p style={{ color: "var(--ink-muted)", marginTop: 2 }}>
              {[categoryDisplay, item.unit, item.partNumber ? `Part #${item.partNumber}` : null].filter(Boolean).join(" · ")}
            </p>
            {item.storageLocation && (
              <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 2 }}>{item.storageLocation}</p>
            )}
          </div>
          <div className="inline-actions inline-actions--end">
            <Link
              href={`/inventory/${inventoryItemId}?householdId=${household.id}`}
              className="button button--ghost button--sm"
            >
              ← Item
            </Link>
            <AssetLabelPrintToolbar />
          </div>
        </header>

        <section className="print-label-sheet">
          <article className="print-label-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/households/${household.id}/inventory/${inventoryItemId}/qr?format=svg&size=240`}
              alt={`QR code for ${item.name}`}
              className="print-label-card__qr"
            />
            <div className="print-label-card__body">
              <p className="print-label-card__name">{item.name}</p>
              {item.partNumber && (
                <p className="print-label-card__tag">{item.partNumber}</p>
              )}
              {(categoryDisplay || item.unit) && (
                <p className="print-label-card__meta">
                  {[categoryDisplay, item.unit].filter(Boolean).join(" · ")}
                </p>
              )}
              {item.storageLocation && (
                <p className="print-label-card__meta">{item.storageLocation}</p>
              )}
              {item.manufacturer && (
                <p className="print-label-card__meta">{item.manufacturer}</p>
              )}
            </div>
          </article>
        </section>
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
