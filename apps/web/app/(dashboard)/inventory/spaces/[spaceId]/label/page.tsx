import type { JSX } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssetLabelPrintToolbar } from "../../../../../../components/asset-label-print-toolbar";
import { ApiError, getMe, getSpace } from "../../../../../../lib/api";
import { getSpaceTypeBadge, getSpaceTypeLabel } from "../../../../../../lib/spaces";

type SpaceLabelPageProps = {
  params: Promise<{ spaceId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SpaceLabelPage({ params, searchParams }: SpaceLabelPageProps): Promise<JSX.Element> {
  const { spaceId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const householdIdParam = typeof resolvedSearchParams.householdId === "string" ? resolvedSearchParams.householdId : undefined;

  const me = await getMe();
  const household = me.households.find((h) => h.id === householdIdParam) ?? me.households[0];
  if (!household) notFound();

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section>}>
      <SpaceLabelContent householdId={household.id} spaceId={spaceId} />
    </Suspense>
  );
}

async function SpaceLabelContent({ householdId, spaceId }: { householdId: string; spaceId: string }): Promise<JSX.Element> {
  try {
    const space = await getSpace(householdId, spaceId);
    const breadcrumbPath = space.breadcrumb.map((s) => s.name).join(" › ");

    return (
      <main className="print-label-page">
        <header className="print-label-toolbar print-hidden">
          <div>
            <p className="eyebrow">Space Label</p>
            <h1>{space.name}</h1>
            <p>{space.shortCode} · {getSpaceTypeLabel(space.type)}</p>
            {breadcrumbPath && <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>{breadcrumbPath}</p>}
          </div>
          <div className="inline-actions inline-actions--end">
            <Link
              href={`/inventory/spaces/${spaceId}?householdId=${householdId}`}
              className="button button--ghost button--sm"
            >
              ← Space
            </Link>
            <AssetLabelPrintToolbar />
          </div>
        </header>

        <section className="print-label-sheet">
          <article className="print-label-card">
            <img
              src={`/api/households/${householdId}/spaces/${spaceId}/qr?format=svg&size=240`}
              alt={`QR code for ${space.name}`}
              className="print-label-card__qr"
            />
            <div className="print-label-card__body">
              <p className="print-label-card__name">{space.name}</p>
              <p className="print-label-card__tag">{space.shortCode}</p>
              <p className="print-label-card__meta">{getSpaceTypeBadge(space.type)} {getSpaceTypeLabel(space.type)}</p>
              {breadcrumbPath && (
                <p className="print-label-card__meta" style={{ fontSize: "0.72rem" }}>{breadcrumbPath}</p>
              )}
            </div>
          </article>
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
