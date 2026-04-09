import type { JSX } from "react";
import { Suspense } from "react";
import { ApiError, getHobbyComments, getHobbyDetail, getMe } from "../../../../../lib/api";
import {
  createHobbyCommentAction,
  deleteHobbyCommentAction,
  updateHobbyCommentAction,
} from "../../../../actions";
import { EntityComments } from "../../../../../components/entity-comments";

type HobbyCommentsPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function HobbyCommentsPage({ params }: HobbyCommentsPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;
  const me = await getMe();
  const household = me.households[0];
  if (!household) return <p>No household found.</p>;

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section>}>
      <CommentsContent householdId={household.id} hobbyId={hobbyId} />
    </Suspense>
  );
}

async function CommentsContent({ householdId, hobbyId }: { householdId: string; hobbyId: string }): Promise<JSX.Element> {
  try {
    const [, comments] = await Promise.all([
      getHobbyDetail(householdId, hobbyId),
      getHobbyComments(householdId, hobbyId),
    ]);

    return (
      <section id="hobby-comments" style={{ padding: "16px 0" }}>
        <EntityComments
          comments={comments}
          config={{
            hiddenFields: { householdId, hobbyId },
            createAction: createHobbyCommentAction,
            updateAction: updateHobbyCommentAction,
            deleteAction: deleteHobbyCommentAction,
          }}
          addCommentPlaceholder="Share tips, record important milestones, or leave notes for other members…"
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
