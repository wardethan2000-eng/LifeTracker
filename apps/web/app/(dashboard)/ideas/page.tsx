import Link from "next/link";
import type { JSX } from "react";
import { IdeaList } from "../../../components/idea-list";

export default function IdeasPage(): JSX.Element {
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Ideas</h1>
          <p className="note">
            Capture thoughts, concepts, and materials before they become plans or projects.
          </p>
        </div>
        <div className="page-header__actions">
          <Link href="/ideas/new" className="button button--primary">
            + New Idea
          </Link>
        </div>
      </header>

      <div className="page-body">
        <IdeaList />
      </div>
    </>
  );
}
