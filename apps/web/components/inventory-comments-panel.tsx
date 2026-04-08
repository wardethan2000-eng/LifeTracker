import type { ThreadedComment } from "@aegis/types";
import type { JSX } from "react";
import {
  createInventoryCommentAction,
  deleteInventoryCommentAction,
  updateInventoryCommentAction
} from "../app/actions";
import { formatDateTime } from "../lib/formatters";

type InventoryCommentsPanelProps = {
  householdId: string;
  inventoryItemId: string;
  comments: ThreadedComment[];
};

type CommentCardProps = {
  householdId: string;
  inventoryItemId: string;
  comment: ThreadedComment | ThreadedComment["replies"][number];
  allowReplies?: boolean;
};

function CommentCard({ householdId, inventoryItemId, comment, allowReplies = false }: CommentCardProps): JSX.Element {
  return (
    <article className="schedule-card">
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

      <form action={updateInventoryCommentAction} className="form-grid" style={{ marginBottom: "16px" }}>
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="inventoryItemId" value={inventoryItemId} />
        <input type="hidden" name="commentId" value={comment.id} />
        <label className="field field--full">
          <span>Edit Comment</span>
          <textarea name="body" rows={2} defaultValue={comment.body} required />
        </label>
        <button type="submit" className="button button--ghost">Save Edit</button>
      </form>

      {allowReplies ? (
        <form action={createInventoryCommentAction} className="form-grid" style={{ marginBottom: "16px" }}>
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="inventoryItemId" value={inventoryItemId} />
          <input type="hidden" name="parentCommentId" value={comment.id} />
          <label className="field field--full">
            <span>Reply</span>
            <textarea name="body" rows={2} placeholder="Add a threaded reply" required />
          </label>
          <button type="submit" className="button button--primary">Reply</button>
        </form>
      ) : null}

      <form action={deleteInventoryCommentAction} className="inline-actions inline-actions--end">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="inventoryItemId" value={inventoryItemId} />
        <input type="hidden" name="commentId" value={comment.id} />
        <button type="submit" className="button button--danger button--sm">Delete Comment</button>
      </form>
    </article>
  );
}

export function InventoryCommentsPanel({ householdId, inventoryItemId, comments }: InventoryCommentsPanelProps): JSX.Element {
  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section className="panel">
        <div className="panel__header">
          <h2>Comments</h2>
          <span className="pill">{comments.length}</span>
        </div>
        <div className="panel__body--padded">
          <form action={createInventoryCommentAction} className="form-grid" style={{ marginBottom: comments.length > 0 ? "24px" : 0 }}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="inventoryItemId" value={inventoryItemId} />
            <label className="field field--full">
              <span>New Comment</span>
              <textarea name="body" rows={3} placeholder="Leave supplier notes, change rationale, or handoff context" required />
            </label>
            <button type="submit" className="button button--primary">Post Comment</button>
          </form>

          {comments.length === 0 ? (
            <p className="panel__empty">No comments on this inventory item yet.</p>
          ) : (
            <div className="schedule-stack">
              {comments.map((comment) => (
                <div key={comment.id}>
                  <CommentCard
                    householdId={householdId}
                    inventoryItemId={inventoryItemId}
                    comment={comment}
                    allowReplies
                  />
                  {comment.replies.length > 0 ? (
                    <div style={{ display: "grid", gap: "12px", marginTop: "18px", paddingLeft: "18px", borderLeft: "2px solid var(--border-color)" }}>
                      {comment.replies.map((reply) => (
                        <CommentCard
                          key={reply.id}
                          householdId={householdId}
                          inventoryItemId={inventoryItemId}
                          comment={reply}
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