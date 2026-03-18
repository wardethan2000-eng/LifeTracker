import type { JSX } from "react";
import { getTranslations } from "next-intl/server";
import { createAssetAction } from "../../../actions";
import { AssetProfileWorkbench } from "../../../../components/asset-profile-workbench";
import { ApiError, getHouseholdAssets, getHouseholdPresets, getLibraryPresets, getMe } from "../../../../lib/api";
import Link from "next/link";

export default async function NewAssetPage(): Promise<JSX.Element> {
  const t = await getTranslations("assets");
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

    const [presets, customPresets, householdAssets] = await Promise.all([
      getLibraryPresets(),
      getHouseholdPresets(household.id),
      getHouseholdAssets(household.id)
    ]);

    return (
      <>
        <header className="page-header">
          <div>
            <h1>{t("newPageTitle")}</h1>
          </div>
        </header>

        <div className="page-body">
          <AssetProfileWorkbench
            action={createAssetAction}
            householdId={household.id}
            householdAssets={householdAssets}
            submitLabel="Create Asset"
            libraryPresets={presets}
            customPresets={customPresets}
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
