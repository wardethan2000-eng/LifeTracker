import type { JSX } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AssetCreationWizard } from "../../../../components/asset-creation-wizard";
import { ApiError, getHouseholdPresets, getLibraryPresets, getMe } from "../../../../lib/api";

type NewAssetPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewAssetPage({ searchParams }: NewAssetPageProps): Promise<JSX.Element> {
  const [t, resolvedParams, me] = await Promise.all([
    getTranslations("assets"),
    searchParams ?? Promise.resolve({}),
    getMe(),
  ]);
  const parentAssetId = typeof resolvedParams.parentAssetId === "string" ? resolvedParams.parentAssetId : undefined;
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
        <Suspense fallback={<div className="panel"><div className="panel__empty">Loading…</div></div>}>
          <NewAssetContent householdId={household.id} parentAssetId={parentAssetId} />
        </Suspense>
      </div>
    </>
  );
}

async function NewAssetContent({ householdId, parentAssetId }: { householdId: string; parentAssetId?: string }): Promise<JSX.Element> {
  try {
    const [presets, customPresets] = await Promise.all([
      getLibraryPresets(),
      getHouseholdPresets(householdId),
    ]);

    return (
      <AssetCreationWizard
        householdId={householdId}
        libraryPresets={presets}
        customPresets={customPresets}
        initialParentAssetId={parentAssetId}
      />
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}
