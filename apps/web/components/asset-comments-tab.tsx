import type { AssetDetailResponse, ThreadedComment } from "@lifekeeper/types";
import type { JSX } from "react";
import {
  createCommentAction,
  deleteCommentAction,
  updateCommentAction
} from "../app/actions";
import { formatDateTime } from "../lib/formatters";

type AssetCommentsTabProps = {
  detail: AssetDetailResponse;
  assetId: string;
  comments: ThreadedComment[];
};

export async function AssetCommentsTab({ detail, assetId, comments }: AssetCommentsTabProps): Promise<JSX.Element> {

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
                <article key={comment.id} className="schedule-card">
                  <div className="schedule-card__summary">
                    <div>
                      <h3>{comment.author.displayName ?? "Household member"}</h3>
                      <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                        {formatDateTime(comment.createdAt)}
                        {comment.editedAt ? ` • edited ${formatDateTime(comment.editedAt)}` : ""}
                      </p>
                    </div>
                  </div>

                  <p style={{ margin: "0 0 16px 0", whiteSpace: "pre-wrap" }}>{comment.body}</p>

                  <form action={updateCommentAction} className="form-grid" style={{ marginBottom: "16px" }}>
                    <input type="hidden" name="assetId" value={detail.asset.id} />
                    <input type="hidden" name="commentId" value={comment.id} />
                    <label className="field field--full">
                      <span>Edit Comment</span>
                      <textarea name="body" rows={2} defaultValue={comment.body} required />
                    </label>
                    <button type="submit" className="button button--ghost">Save Edit</button>
                  </form>

                  <form action={createCommentAction} className="form-grid" style={{ marginBottom: "16px" }}>
                    <input type="hidden" name="assetId" value={detail.asset.id} />
                    <input type="hidden" name="householdId" value={detail.asset.householdId} />
                    <input type="hidden" name="parentCommentId" value={comment.id} />
                    <label className="field field--full">
                      <span>Reply</span>
                      <textarea name="body" rows={2} placeholder="Add a threaded reply" required />
                    </label>
                    <button type="submit" className="button button--primary">Reply</button>
                  </form>

                  <form action={deleteCommentAction} className="inline-actions inline-actions--end">
                    <input type="hidden" name="assetId" value={detail.asset.id} />
                    <input type="hidden" name="householdId" value={detail.asset.householdId} />
                    <input type="hidden" name="commentId" value={comment.id} />
                    <button type="submit" className="button button--danger button--sm">Delete Comment</button>
                  </form>

                  {comment.replies.length > 0 ? (
                    <div style={{ display: "grid", gap: "12px", marginTop: "18px", paddingLeft: "18px", borderLeft: "2px solid var(--border-color)" }}>
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="schedule-card">
                          <div className="schedule-card__summary">
                            <div>
                              <h3>{reply.author.displayName ?? "Household member"}</h3>
                              <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                                {formatDateTime(reply.createdAt)}
                                {reply.editedAt ? ` • edited ${formatDateTime(reply.editedAt)}` : ""}
                              </p>
                            </div>
                          </div>
                          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{reply.body}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}