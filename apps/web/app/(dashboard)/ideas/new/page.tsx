import type { JSX } from "react";
import Link from "next/link";
import { getMe } from "../../../../lib/api";
import { IdeaWorkbench } from "../../../../components/idea-workbench";

export default async function NewIdeaPage(): Promise<JSX.Element> {
  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return (
      <>
        <header className="page-header">
          <div><h1>Capture an Idea</h1></div>
        </header>
        <div className="page-body">
          <p>No household found. <Link href="/" className="text-link">Go to Dashboard</Link>.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Capture an Idea</h1>
          <p className="note">
            Jot it down now — escalate to a project, asset, or hobby later.
          </p>
        </div>
        <div className="page-header__actions">
          <Link href="/ideas" className="button button--ghost">
            ← Ideas
          </Link>
        </div>
      </header>

      <div className="page-body">
        <IdeaWorkbench householdId={household.id} />
      </div>
    </>
  );
}
