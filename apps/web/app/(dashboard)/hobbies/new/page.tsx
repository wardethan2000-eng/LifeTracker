import type { JSX } from "react";
import { createHobbyAction } from "../../../actions";
import { HobbyWorkbench } from "../../../../components/hobby-workbench";
import { getMe } from "../../../../lib/api";
import { hobbyPresetLibrary } from "@aegis/presets";
import Link from "next/link";

export default async function NewHobbyPage(): Promise<JSX.Element> {
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
}
