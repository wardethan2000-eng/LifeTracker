import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ApiError, getDisplayPreferences, getHouseholdAssetsPaginated, getHouseholdDueWork, getMe } from "../../../lib/api";
import { AssetListWorkspace } from "../../../components/asset-list-workspace";
import { OffsetPaginationControls } from "../../../components/pagination-controls";

const limitOptions = [25, 50, 100] as const;

// ── Deferred list content — runs in parallel with page header render ──────────

type AssetListContentProps = {
  householdId: string;
  limit: number;
  offset: number;
  includeArchived: boolean;
  search: string;
  category: string;
};

async function AssetListContent({ householdId, limit, offset, includeArchived, search, category }: AssetListContentProps): Promise<JSX.Element> {
  const t = await getTranslations("assets");

  const buildHref = (p: { offset: number; limit: number }): string => {
    const query = new URLSearchParams();
    query.set("householdId", householdId);
    if (includeArchived) query.set("includeArchived", "true");
    if (search) query.set("search", search);
    if (category) query.set("category", category);
    query.set("limit", String(p.limit));
    query.set("offset", String(p.offset));
    return `/assets?${query.toString()}`;
  };

  try {
    const [assetPage, dueWork] = await Promise.all([
      getHouseholdAssetsPaginated(householdId, {
        limit,
        offset,
        includeArchived,
        ...(search ? { search } : {}),
        ...(category ? { category } : {}),
      }),
      getHouseholdDueWork(householdId, { limit: 500 }),
    ]);

    const scheduleCountsByAssetId = new Map<string, { overdue: number; due: number }>();
    for (const item of dueWork) {
      const counts = scheduleCountsByAssetId.get(item.assetId) ?? { overdue: 0, due: 0 };
      if (item.status === "overdue") counts.overdue++;
      else if (item.status === "due") counts.due++;
      scheduleCountsByAssetId.set(item.assetId, counts);
    }

    const unlocatedCount = assetPage.items.filter((a) => !a.spaceId).length;

    return (
      <>
        {unlocatedCount > 0 && !search && !category && (
          <p className="note">
            <strong>{unlocatedCount} asset{unlocatedCount === 1 ? " on this page doesn't" : "s on this page don't"} have a location assigned.</strong>{" "}
            <Link href={`/inventory/spaces?householdId=${householdId}`} className="text-link">Set up spaces</Link> and assign assets to see where everything is.
          </p>
        )}
        <section className="panel">
          <div className="panel__header">
            <h2>{t("listTitle", { count: assetPage.total })}</h2>
          </div>
          <div className="panel__body">
            <AssetListWorkspace householdId={householdId} assets={assetPage.items} totalAssets={assetPage.total} includeArchived={includeArchived} currentSearch={search} currentCategory={category} scheduleCountsByAssetId={scheduleCountsByAssetId} />
          </div>
        </section>
        <OffsetPaginationControls
          total={assetPage.total}
          limit={assetPage.limit}
          offset={assetPage.offset}
          hasMore={assetPage.hasMore}
          entityLabel="assets"
          buildHref={buildHref}
        />
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load assets: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

type AssetsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AssetsPage({ searchParams }: AssetsPageProps): Promise<JSX.Element> {
  // All setup runs in parallel — getMe() is cached 5 min, getDisplayPreferences 60s.
  const [t, tCommon, params, prefs, me] = await Promise.all([
    getTranslations("assets"),
    getTranslations("common"),
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
    getDisplayPreferences().catch(() => ({ pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" })),
    getMe(),
  ]);

  const householdId = typeof params.householdId === "string" ? params.householdId : undefined;
  const household = me.households.find((h) => h.id === householdId) ?? me.households[0];
  const includeArchived = params.includeArchived === "true";
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const category = typeof params.category === "string" ? params.category : "";
  const limit = typeof params.limit === "string" && limitOptions.includes(Number(params.limit) as (typeof limitOptions)[number])
    ? Number(params.limit)
    : prefs.pageSize;
  const offset = typeof params.offset === "string" && Number.isInteger(Number(params.offset)) && Number(params.offset) >= 0
    ? Number(params.offset)
    : 0;

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

  const listSkeleton = (
    <section className="panel">
      <div className="panel__header">
        <div className="skeleton-bar" style={{ width: 200, height: 20 }} />
      </div>
      <div className="panel__body">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, marginBottom: 8, borderRadius: 6 }} />
        ))}
      </div>
    </section>
  );

  return (
    <>
      <header className="page-header">
        <h1>{t("pageTitle")}</h1>
        <div className="page-header__actions">
          <Link href="/assets/new" className="button button--primary">{tCommon("actions.addAsset")}</Link>
        </div>
      </header>
      <div className="page-body">
        <Suspense fallback={listSkeleton}>
          <AssetListContent
            householdId={household.id}
            limit={limit}
            offset={offset}
            includeArchived={includeArchived}
            search={search}
            category={category}
          />
        </Suspense>
      </div>
    </>
  );
}
