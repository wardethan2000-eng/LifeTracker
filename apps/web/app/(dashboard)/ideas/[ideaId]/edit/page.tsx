import type { JSX } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { ApiError, getIdea, getMe } from "../../../../../lib/api";
import { IdeaWorkbench } from "../../../../../components/idea-workbench";

type EditIdeaPageProps = {
  params: Promise<{ ideaId: string }>;
};

export default async function EditIdeaPage({ params }: EditIdeaPageProps): Promise<JSX.Element> {
  const { ideaId } = await params;
  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return <p>No household found. <Link href="/ideas" className="text-link">← Ideas</Link>.</p>;
  }

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading…</div></div>}>
      <EditContent householdId={household.id} ideaId={ideaId} />
    </Suspense>
  );
}

async function EditContent({ householdId, ideaId }: { householdId: string; ideaId: string }): Promise<JSX.Element> {
  try {
    const idea = await getIdea(householdId, ideaId);

    return (
      <>
        <header className="page-header">
          <div>
            <h1>Edit Idea</h1>
            <p className="note">{idea.title}</p>
          </div>
          <div className="page-header__actions">
            <Link href={`/ideas/${ideaId}`} className="button button--ghost">
              ← Idea
            </Link>
          </div>
        </header>

        <div className="page-body">
          <IdeaWorkbench householdId={householdId} idea={idea} />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load idea: {error.message}</p>
            <Link href="/ideas" className="text-link">← Ideas</Link>
          </div>
        </div>
      );
    }
    throw error;
  }
}
