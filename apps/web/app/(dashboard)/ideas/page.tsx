import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import { ApiError, getHouseholdIdeas, getMe } from "../../../lib/api";
import { IdeaList } from "../../../components/idea-list";
import { IdeaLocalMigration } from "../../../components/idea-local-migration";
import { PageHeader } from "../../../components/page-header";
import { SkeletonBlock } from "../../../components/skeleton";

const IdeasSkeleton = (): JSX.Element => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <section key={i} className="panel" aria-hidden="true">
        <div className="panel__header" style={{ gap: "8px" }}>
          <SkeletonBlock variant="pill" width="sm" />
          <SkeletonBlock variant="pill" width="xs" />
        </div>
        <div className="panel__body--padded" style={{ display: "grid", gap: "10px" }}>
          <SkeletonBlock variant="row" width="lg" />
          <SkeletonBlock variant="row" width="full" />
          <SkeletonBlock variant="row" width="md" />
        </div>
      </section>
    ))}
  </div>
);

// ── Ideas pipeline summary bar ─────────────────────────────
type IdeaPipelineBarProps = {
  spark: number;
  developing: number;
  ready: number;
  total: number;
};

function IdeaPipelineBar({ spark, developing, ready, total }: IdeaPipelineBarProps): JSX.Element {
  if (total === 0) return <></>;
  return (
    <div className="idea-pipeline">
      <div className="idea-pipeline__stage idea-pipeline__stage--spark">
        <span className="idea-pipeline__count">{spark}</span>
        <span className="idea-pipeline__label">Spark</span>
        <div className="idea-pipeline__bar">
          <div className="idea-pipeline__fill" style={{ width: `${Math.round((spark / total) * 100)}%` }} />
        </div>
      </div>
      <div className="idea-pipeline__arrow" aria-hidden="true">→</div>
      <div className="idea-pipeline__stage idea-pipeline__stage--developing">
        <span className="idea-pipeline__count">{developing}</span>
        <span className="idea-pipeline__label">Developing</span>
        <div className="idea-pipeline__bar">
          <div className="idea-pipeline__fill" style={{ width: `${Math.round((developing / total) * 100)}%` }} />
        </div>
      </div>
      <div className="idea-pipeline__arrow" aria-hidden="true">→</div>
      <div className="idea-pipeline__stage idea-pipeline__stage--ready">
        <span className="idea-pipeline__count">{ready}</span>
        <span className="idea-pipeline__label">Ready</span>
        <div className="idea-pipeline__bar">
          <div className="idea-pipeline__fill" style={{ width: `${Math.round((ready / total) * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Deferred list content ──────────────────────────────────
async function IdeasListContent({ householdId }: { householdId: string }): Promise<JSX.Element> {
  try {
    const ideas = await getHouseholdIdeas(householdId);
    const spark = ideas.filter((i) => i.stage === "spark").length;
    const developing = ideas.filter((i) => i.stage === "developing").length;
    const ready = ideas.filter((i) => i.stage === "ready").length;
    return (
      <>
        <IdeaLocalMigration householdId={householdId} />
        <IdeaPipelineBar spark={spark} developing={developing} ready={ready} total={ideas.length} />
        <IdeaList ideas={ideas} householdId={householdId} />
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <section className="panel">
          <div className="panel__body--padded">
            <p className="panel__empty">{error.message}</p>
          </div>
        </section>
      );
    }
    throw error;
  }
}

// ── Page ──────────────────────────────────────────────────
export default async function IdeasPage(): Promise<JSX.Element> {
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
        <Suspense fallback={<IdeasSkeleton />}>
          <IdeasListContent householdId={household.id} />
        </Suspense>
      </div>
    </>
  );
}
