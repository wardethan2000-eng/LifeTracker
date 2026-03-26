import type { JSX } from "react";
import { getTranslations } from "next-intl/server";
import { createAssetAction } from "../../../actions";
import { AssetProfileWorkbench } from "../../../../components/asset-profile-workbench";
import { ApiError, getHouseholdAssets, getHouseholdPresets, getHouseholdSpacesTree, getLibraryPresets, getMe } from "../../../../lib/api";
import Link from "next/link";

type NewAssetPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewAssetPage({ searchParams }: NewAssetPageProps): Promise<JSX.Element> {
  const t = await getTranslations("assets");
  const resolvedParams = await (searchParams ?? Promise.resolve({}));
  const parentAssetId = typeof resolvedParams.parentAssetId === "string" ? resolvedParams.parentAssetId : undefined;

  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return (
        <>
          <header className="page-header"><h1>{t("newPageTitle")}</h1></header>
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
          </div>
        </>
      );
    }

    const [presets, customPresets, householdAssets, spaces] = await Promise.all([
      getLibraryPresets(),
      getHouseholdPresets(household.id),
      getHouseholdAssets(household.id),
      getHouseholdSpacesTree(household.id).catch(() => [])
    ]);

    const parentAsset = parentAssetId ? householdAssets.find((a) => a.id === parentAssetId) : undefined;

    return (
      <>
        <header className="page-header">
          <div>
            <h1>{t("newPageTitle")}</h1>
          </div>
        </header>

        <div className="page-body">
          {parentAsset && (
            <div className="info-bar" style={{ marginBottom: "16px" }}>
              <span>
                Creating a component of{" "}
                <Link href={`/assets/${parentAsset.id}`} className="text-link">
                  {parentAsset.name}
                </Link>
                . The parent asset will be pre-selected below.
              </span>
            </div>
          )}
          <AssetProfileWorkbench
            action={createAssetAction}
            householdId={household.id}
            householdAssets={householdAssets}
            submitLabel="Create Asset"
            libraryPresets={presets}
            customPresets={customPresets}
            initialParentAssetId={parentAssetId}
            spaces={spaces}
          />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>{t("newPageTitle")}</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load: {error.message}</p>
              </div>
            </div>
          </div>
        </>
      );
    }
    throw error;
  }
}
