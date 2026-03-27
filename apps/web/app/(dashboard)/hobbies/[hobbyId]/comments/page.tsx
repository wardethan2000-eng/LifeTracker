import type { JSX } from "react";
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

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    const [, comments] = await Promise.all([
      getHobbyDetail(household.id, hobbyId),
      getHobbyComments(household.id, hobbyId),
    ]);

    return (
      <section id="hobby-comments" style={{ padding: "16px 0" }}>
        <EntityComments
          comments={comments}
          config={{
            hiddenFields: { householdId: household.id, hobbyId },
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
