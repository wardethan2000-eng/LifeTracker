import Link from "next/link";
import type { JSX } from "react";
import { getTranslations } from "next-intl/server";
import { ApiError, getHouseholdAssets, getMe } from "../../../lib/api";
import {
  formatCategoryLabel,
  formatDate,
  formatVisibilityLabel
} from "../../../lib/formatters";

type AssetsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AssetsPage({ searchParams }: AssetsPageProps): Promise<JSX.Element> {
  const t = await getTranslations("assets");
  const tCommon = await getTranslations("common");
  const params = searchParams ? await searchParams : {};
  const householdId = typeof params.householdId === "string" ? params.householdId : undefined;

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

    const assets = await getHouseholdAssets(household.id);
    const sortedAssets = [...assets].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
          <section className="panel">
            <div className="panel__header">
              <h2>{t("listTitle", { count: sortedAssets.length })}</h2>
            </div>
            <div className="panel__body">
              {sortedAssets.length === 0 ? (
                <p className="panel__empty">
                  {t("empty")} <Link href="/assets/new" className="text-link">{t("emptyLink")}</Link> {t("emptySuffix")}
                </p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Category</th>
                      <th>Visibility</th>
                      <th>Status</th>
                      <th>Manufacturer</th>
                      <th>Model</th>
                      <th>Created</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAssets.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="data-table__primary">
                            <Link href={`/assets/${item.id}`} className="data-table__link">{item.name}</Link>
                          </div>
                        </td>
                        <td><span className="pill">{formatCategoryLabel(item.category)}</span></td>
                        <td><span className="pill">{formatVisibilityLabel(item.visibility)}</span></td>
                        <td>{item.isArchived ? tCommon("status.archived") : tCommon("status.active")}</td>
                        <td>{item.manufacturer ?? "—"}</td>
                        <td>{item.model ?? "—"}</td>
                        <td>{formatDate(item.createdAt)}</td>
                        <td>
                          <Link href={`/assets/${item.id}`} className="data-table__link">{tCommon("actions.open")}</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
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