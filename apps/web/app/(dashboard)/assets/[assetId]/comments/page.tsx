import type { JSX } from "react";
import { ApiError, getAssetComments, getAssetDetail, getMe } from "../../../../../lib/api";
import {
  createCommentAction,
  deleteCommentAction,
  updateCommentAction,
} from "../../../../actions";
import { EntityComments } from "../../../../../components/entity-comments";

type AssetCommentsPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetCommentsPage({ params }: AssetCommentsPageProps): Promise<JSX.Element> {
  const { assetId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    const [detail, comments] = await Promise.all([
      getAssetDetail(assetId),
      getAssetComments(assetId),
    ]);

    return (
      <section id="asset-comments" style={{ padding: "16px 0" }}>
        <EntityComments
          comments={comments}
          config={{
            hiddenFields: {
              assetId: detail.asset.id,
              householdId: detail.asset.householdId,
            },
            createAction: createCommentAction,
            updateAction: updateCommentAction,
            deleteAction: deleteCommentAction,
          }}
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
