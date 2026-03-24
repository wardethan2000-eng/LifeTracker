import Link from "next/link";
import type { JSX } from "react";
import { getTranslations } from "next-intl/server";
import { ApiError, getHouseholdAssetsPaginated, getMe } from "../../../lib/api";
import { AssetListWorkspace } from "../../../components/asset-list-workspace";
import { OffsetPaginationControls } from "../../../components/pagination-controls";

const limitOptions = [25, 50, 100] as const;

type AssetsPageProps = {
  
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AssetsPage({ searchParams }: AssetsPageProps): Promise<JSX.Element> {
  const t = await getTranslations("assets");
  const tCommon = await getTranslations("common");
  const params = searchParams ? await searchParams : {};
  const householdId = typeof params.householdId === "string" ? params.householdId : undefined;
  const includeArchived = params.includeArchived === "true";
  const limit = typeof params.limit === "string" && limitOptions.includes(Number(params.limit) as (typeof limitOptions)[number])
    ? Number(params.limit)
    : 25;
  const offset = typeof params.offset === "string" && Number.isInteger(Number(params.offset)) && Number(params.offset) >= 0
    ? Number(params.offset)
    : 0;

  const buildHref = (p: { offset: number; limit: number }): string => {
    const query = new URLSearchParams();
    if (householdId) query.set("householdId", householdId);
    if (includeArchived) query.set("includeArchived", "true");
    query.set("limit", String(p.limit));
    query.set("offset", String(p.offset));
    return `/assets?${query.toString()}`;
  };

  try {
    const me = await getMe();
    const household = me.households.find((h) => h.id === householdId) ?? me.households[0];

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

    const assetPage = await getHouseholdAssetsPaginated(household.id, { limit, offset, includeArchived });

    return (
      <>
        <header className="page-header">
          <h1>{t("pageTitle")}</h1>
          <div className="page-header__actions">
            <Link href="/assets/new" className="button button--primary">{tCommon("actions.addAsset")}</Link>
          </div>
        </header>

        <div className="page-body">
          <section className="panel">
            <div className="panel__header">
              <h2>{t("listTitle", { count: assetPage.total })}</h2>
            </div>
            <div className="panel__body">
              <AssetListWorkspace householdId={household.id} assets={assetPage.items} totalAssets={assetPage.total} includeArchived={includeArchived} />
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
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>{t("pageTitle")}</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load assets: {error.message}</p>
              </div>
            </div>
          </div>
        </>
      );
    }

    throw error;
  }
}