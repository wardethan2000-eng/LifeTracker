import type { JSX } from "react";
import { Suspense } from "react";
import { ApiError, getIdeaComments, getIdea, getMe } from "../../../../../lib/api";
import {
  createIdeaCommentAction,
  deleteIdeaCommentAction,
  updateIdeaCommentAction,
} from "../../../../actions";
import { EntityComments } from "../../../../../components/entity-comments";

type IdeaCommentsPageProps = {
  params: Promise<{ ideaId: string }>;
};

export default async function IdeaCommentsPage({ params }: IdeaCommentsPageProps): Promise<JSX.Element> {
  const { ideaId } = await params;
  const me = await getMe();
  const household = me.households[0];
  if (!household) return <p>No household found.</p>;

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading comments…</div></div>}>
      <CommentsContent householdId={household.id} ideaId={ideaId} />
    </Suspense>
  );
}

async function CommentsContent({ householdId, ideaId }: { householdId: string; ideaId: string }): Promise<JSX.Element> {
  try {
    const [, comments] = await Promise.all([
      getIdea(householdId, ideaId),
      getIdeaComments(householdId, ideaId),
    ]);

    return (
      <section id="idea-comments" style={{ padding: "16px 0" }}>
        <EntityComments
          comments={comments}
          config={{
            hiddenFields: { householdId, ideaId },
            createAction: createIdeaCommentAction,
            updateAction: updateIdeaCommentAction,
            deleteAction: deleteIdeaCommentAction,
          }}
          addCommentPlaceholder="Add notes, feedback, or questions about this idea…"
        />
      </section>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load comments: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}
