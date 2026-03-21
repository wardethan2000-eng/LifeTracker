import type { JSX } from "react";
import Link from "next/link";
import { ApiError, getIdea, getMe } from "../../../../../lib/api";
import { IdeaWorkbench } from "../../../../../components/idea-workbench";

type EditIdeaPageProps = {
  params: Promise<{ ideaId: string }>;
};

export default async function EditIdeaPage({ params }: EditIdeaPageProps): Promise<JSX.Element> {
  const { ideaId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return <p>No household found. <Link href="/ideas" className="text-link">Go back to Ideas</Link>.</p>;
    }

    const idea = await getIdea(household.id, ideaId);

    return (
      <>
        <header className="page-header">
          <div>
            <h1>Edit Idea</h1>
            <p className="note">{idea.title}</p>
          </div>
          <div className="page-header__actions">
            <Link href={`/ideas/${ideaId}`} className="button button--ghost">
              Back to Idea
            </Link>
          </div>
        </header>

        <div className="page-body">
          <IdeaWorkbench householdId={household.id} idea={idea} />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load idea: {error.message}</p>
            <Link href="/ideas" className="text-link">← Back to Ideas</Link>
          </div>
        </div>
      );
    }
    throw error;
  }
}
