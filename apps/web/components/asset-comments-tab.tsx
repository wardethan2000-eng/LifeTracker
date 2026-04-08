import type { AssetDetailResponse, DateFormat, ThreadedComment } from "@aegis/types";
import type { JSX } from "react";
import {
  createCommentAction,
  deleteCommentAction,
  updateCommentAction
} from "../app/actions";
import { formatDateTime } from "../lib/formatters";
import { getDisplayPreferences } from "../lib/api";

type AssetCommentsTabProps = {
  detail: AssetDetailResponse;
  assetId: string;
  comments: ThreadedComment[];
};

type CommentCardProps = {
  assetId: string;
  householdId: string;
  comment: ThreadedComment | ThreadedComment["replies"][number];
  allowReplies?: boolean;
  dateFormat?: DateFormat;
};

function CommentCard({ assetId, householdId, comment, allowReplies = false, dateFormat = "US" }: CommentCardProps): JSX.Element {
  return (
    <article className="schedule-card">
      <div className="schedule-card__summary">
        <div>
          <h3>{comment.author.displayName ?? "Household member"}</h3>
          <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
            {formatDateTime(comment.createdAt, undefined, undefined, dateFormat)}
            {comment.editedAt ? ` • edited ${formatDateTime(comment.editedAt, undefined, undefined, dateFormat)}` : ""}
          </p>
        </div>
      </div>

      <p style={{ margin: "0 0 16px 0", whiteSpace: "pre-wrap" }}>{comment.body}</p>

      <form action={updateCommentAction} className="form-grid" style={{ marginBottom: "16px" }}>
        <input type="hidden" name="assetId" value={assetId} />
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="commentId" value={comment.id} />
        <label className="field field--full">
          <span>Edit Comment</span>
          <textarea name="body" rows={2} defaultValue={comment.body} required />
        </label>
        <button type="submit" className="button button--ghost">Save Edit</button>
      </form>

      {allowReplies ? (
        <form action={createCommentAction} className="form-grid" style={{ marginBottom: "16px" }}>
          <input type="hidden" name="assetId" value={assetId} />
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="parentCommentId" value={comment.id} />
          <label className="field field--full">
            <span>Reply</span>
            <textarea name="body" rows={2} placeholder="Add a threaded reply" required />
          </label>
          <button type="submit" className="button button--primary">Reply</button>
        </form>
      ) : null}

      <form action={deleteCommentAction} className="inline-actions inline-actions--end">
        <input type="hidden" name="assetId" value={assetId} />
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="commentId" value={comment.id} />
        <button type="submit" className="button button--danger button--sm">Delete Comment</button>
      </form>
    </article>
  );
}

export async function AssetCommentsTab({ detail, assetId, comments }: AssetCommentsTabProps): Promise<JSX.Element> {
  const prefs = await getDisplayPreferences().catch(() => ({ pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" }));

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section className="panel">
        <div className="panel__header">
          <h2>New Comment</h2>
        </div>
        <div className="panel__body--padded">
          <form action={createCommentAction} className="form-grid">
            <input type="hidden" name="assetId" value={detail.asset.id} />
            <input type="hidden" name="householdId" value={detail.asset.householdId} />
            <label className="field field--full">
              <span>Comment</span>
              <textarea name="body" rows={3} placeholder="Leave a note, issue, or handoff for other household members" required />
            </label>
            <button type="submit" className="button button--primary">Post Comment</button>
          </form>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Discussion</h2>
          <span className="pill">{comments.length}</span>
        </div>
        <div className="panel__body">
          {comments.length === 0 ? (
            <p className="panel__empty">No comments on this asset yet.</p>
          ) : (
            <div className="schedule-stack">
              {comments.map((comment) => (
                <div key={comment.id}>
                  <CommentCard
                    assetId={assetId}
                    householdId={detail.asset.householdId}
                    comment={comment}
                    allowReplies
                    dateFormat={prefs.dateFormat}
                  />
                  {comment.replies.length > 0 ? (
                    <div style={{ display: "grid", gap: "12px", marginTop: "18px", paddingLeft: "18px", borderLeft: "2px solid var(--border-color)" }}>
                      {comment.replies.map((reply) => (
                        <CommentCard
                          key={reply.id}
                          assetId={assetId}
                          householdId={detail.asset.householdId}
                          comment={reply}
                          dateFormat={prefs.dateFormat}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}