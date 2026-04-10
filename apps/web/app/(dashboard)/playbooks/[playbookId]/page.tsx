import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import { ApiError, getPlaybook, getPlaybookRuns, getMe } from "../../../../lib/api";
import { PageHeader } from "../../../../components/page-header";
import { PlaybookDetailClient } from "../../../../components/playbook-detail-client";

type PlaybookDetailPageProps = {
  params: Promise<{ playbookId: string }>;
};

async function PlaybookContent({ householdId, playbookId }: { householdId: string; playbookId: string }): Promise<JSX.Element> {
  let playbook;
  let runs;
  try {
    [playbook, runs] = await Promise.all([
      getPlaybook(householdId, playbookId),
      getPlaybookRuns(householdId, playbookId),
    ]);
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded"><p>Failed to load playbook: {error.message}</p></div>
        </div>
      );
    }
    throw error;
  }

  return (
    <PlaybookDetailClient
      householdId={householdId}
      playbookId={playbookId}
      playbook={playbook}
      runs={runs}
    />
  );
}

export default async function PlaybookDetailPage({ params }: PlaybookDetailPageProps): Promise<JSX.Element> {
  const { playbookId } = await params;
  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return <p>No household found.</p>;
  }

  return (
    <>
      <PageHeader
        title="Playbook Detail"
        actions={<Link href="/playbooks" className="button button--ghost button--sm">← All Playbooks</Link>}
      />
      <div className="page-body">
        <Suspense fallback={<div className="panel"><div className="panel__body--padded"><p className="note">Loading…</p></div></div>}>
          <PlaybookContent householdId={household.id} playbookId={playbookId} />
        </Suspense>
      </div>
    </>
  );
}
