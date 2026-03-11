import type { JSX } from "react";
import { createAssetAction } from "../../actions";
import { AppShell } from "../../../components/app-shell";
import { AssetProfileWorkbench } from "../../../components/asset-profile-workbench";
import { ApiError, getHouseholdPresets, getLibraryPresets, getMe } from "../../../lib/api";
import Link from "next/link";

export default async function NewAssetPage(): Promise<JSX.Element> {
  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return (
        <AppShell activePath="/assets/new">
          <header className="page-header"><h1>Add Asset</h1></header>
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
          </div>
        </AppShell>
      );
    }

    const [presets, customPresets] = await Promise.all([
      getLibraryPresets(),
      getHouseholdPresets(household.id)
    ]);

    return (
      <AppShell activePath="/assets/new">
        <header className="page-header">
          <div>
            <h1>Add New Asset</h1>
          </div>
        </header>

        <div className="page-body">
          <AssetProfileWorkbench
            action={createAssetAction}
            householdId={household.id}
            submitLabel="Create Asset"
            libraryPresets={presets}
            customPresets={customPresets}
          />
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <AppShell activePath="/assets/new">
          <header className="page-header"><h1>Add Asset</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load: {error.message}</p>
              </div>
            </div>
          </div>
        </AppShell>
      );
    }
    throw error;
  }
}
