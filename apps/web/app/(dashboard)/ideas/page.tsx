import Link from "next/link";
import type { JSX } from "react";
import { ApiError, getHouseholdIdeas, getMe } from "../../../lib/api";
import { IdeaList } from "../../../components/idea-list";
import { IdeaLocalMigration } from "../../../components/idea-local-migration";
import { PageHeader } from "../../../components/page-header";

export default async function IdeasPage(): Promise<JSX.Element> {
  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return (
        <>
          <PageHeader title="Ideas" />
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to Dashboard</Link> to create one.</p>
          </div>
        </>
      );
    }

    const ideas = await getHouseholdIdeas(household.id);

    return (
      <>
        <PageHeader
          title="Ideas"
          subtitle="Capture thoughts, concepts, and materials before they become plans or projects."
          actions={
            <Link href="/ideas/new" className="button button--primary">
              + New Idea
            </Link>
          }
        />

        <div className="page-body">
          <IdeaLocalMigration householdId={household.id} />
          <IdeaList ideas={ideas} householdId={household.id} />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <PageHeader title="Ideas" />
          <div className="page-body">
            <section className="panel">
              <div className="panel__body--padded">
                <p className="panel__empty">{error.message}</p>
              </div>
            </section>
          </div>
        </>
      );
    }
    throw error;
  }
}
