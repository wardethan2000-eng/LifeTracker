import type { AssetLabelData } from "@aegis/types";
import type { JSX } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssetLabelPrintToolbar } from "../../../../../components/asset-label-print-toolbar";
import { ApiError, getAssetLabelData } from "../../../../../lib/api";
import { formatCategoryLabel } from "../../../../../lib/formatters";

type AssetLabelPageProps = {
  params: Promise<{ assetId: string }>;
  searchParams: Promise<{ layout?: string; copies?: string }>;
};

const clampCopies = (value: string | undefined): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(24, Math.max(1, Math.floor(parsed)));
};

const renderLabelCard = (label: AssetLabelData, index: number, assetId: string): JSX.Element => (
  <article key={`${label.assetId}-${index}`} className="print-label-card">
    <img
      src={`/api/assets/${assetId}/label?format=svg&size=240`}
      alt={`QR code for ${label.name}`}
      className="print-label-card__qr"
    />
    <div className="print-label-card__body">
      <p className="print-label-card__name">{label.name}</p>
      <p className="print-label-card__tag">{label.assetTag}</p>
      <p className="print-label-card__meta">{formatCategoryLabel(label.category)}</p>
      {label.serialNumber ? <p className="print-label-card__meta">S/N {label.serialNumber}</p> : null}
    </div>
  </article>
);

export default async function AssetLabelPage({ params, searchParams }: AssetLabelPageProps): Promise<JSX.Element> {
  const [{ assetId }, { layout = "single", copies }] = await Promise.all([params, searchParams]);

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading label…</div></div>}>
      <LabelContent assetId={assetId} layout={layout} copies={copies} />
    </Suspense>
  );
}

async function LabelContent({ assetId, layout, copies }: { assetId: string; layout: string; copies?: string }): Promise<JSX.Element> {
  try {
    const label = await getAssetLabelData(assetId);
    const labelCount = layout === "sheet" ? Math.max(6, clampCopies(copies)) : 1;

    return (
      <main className="print-label-page">
        <header className="print-label-toolbar print-hidden">
          <div>
            <p className="eyebrow">Asset Label</p>
            <h1>{label.name}</h1>
            <p>{label.assetTag} · {formatCategoryLabel(label.category)}</p>
          </div>
          <div className="inline-actions inline-actions--end">
            <Link href={`/assets/${assetId}`} className="button button--ghost button--sm">← Asset</Link>
            <Link href={`/assets/${assetId}/label?layout=single`} className="button button--ghost button--sm">Single</Link>
            <Link href={`/assets/${assetId}/label?layout=sheet&copies=10`} className="button button--ghost button--sm">Sheet x10</Link>
            <AssetLabelPrintToolbar />
          </div>
        </header>

        <section className={`print-label-sheet${layout === "sheet" ? " print-label-sheet--grid" : ""}`}>
          {Array.from({ length: labelCount }, (_, index) => renderLabelCard(label, index, assetId))}
        </section>
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}