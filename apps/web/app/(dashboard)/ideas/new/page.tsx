import type { JSX } from "react";
import Link from "next/link";
import { IdeaWorkbench } from "../../../../components/idea-workbench";

export default function NewIdeaPage(): JSX.Element {
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
            Back to Ideas
          </Link>
        </div>
      </header>

      <div className="page-body">
        <IdeaWorkbench />
      </div>
    </>
  );
}
