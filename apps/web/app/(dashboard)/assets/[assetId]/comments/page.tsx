import type { JSX } from "react";
import { Suspense } from "react";
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
  const me = await getMe();
  const household = me.households[0];
  if (!household) return <p>No household found.</p>;

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading comments…</div></div>}>
      <CommentsContent assetId={assetId} />
    </Suspense>
  );
}

async function CommentsContent({ assetId }: { assetId: string }): Promise<JSX.Element> {
  try {
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
