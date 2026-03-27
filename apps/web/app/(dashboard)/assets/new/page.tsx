import type { JSX } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AssetCreationWizard } from "../../../../components/asset-creation-wizard";
import { ApiError, getHouseholdPresets, getLibraryPresets, getMe } from "../../../../lib/api";

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

    const [presets, customPresets] = await Promise.all([
      getLibraryPresets(),
      getHouseholdPresets(household.id),
    ]);

    return (
      <>
        <header className="page-header">
          <div>
            <h1>{t("newPageTitle")}</h1>
          </div>
        </header>

        <div className="page-body">
          {parentAssetId && (
            <div className="info-bar" style={{ marginBottom: "16px" }}>
              <span>
                Creating a component of an asset. Fill in the details below.
              </span>
            </div>
          )}
          <AssetCreationWizard
            householdId={household.id}
            libraryPresets={presets}
            customPresets={customPresets}
            initialParentAssetId={parentAssetId}
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
