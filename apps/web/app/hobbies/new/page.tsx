import type { JSX } from "react";
import { createHobbyAction } from "../../actions";
import { HobbyWorkbench } from "../../../components/hobby-workbench";
import { ApiError, getMe } from "../../../lib/api";
import { hobbyPresetLibrary } from "@lifekeeper/presets";
import Link from "next/link";

export default async function NewHobbyPage(): Promise<JSX.Element> {
  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return (
        <>
          <header className="page-header"><h1>New Hobby</h1></header>
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
            <h1>New Hobby</h1>
          </div>
        </header>

        <div className="page-body">
          <HobbyWorkbench
            mode="create"
            action={createHobbyAction}
            householdId={household.id}
            presets={hobbyPresetLibrary}
          />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>New Hobby</h1></header>
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
