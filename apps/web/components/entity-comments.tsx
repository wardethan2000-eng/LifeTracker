import type { DateFormat, ThreadedComment } from "@aegis/types";
import type { JSX } from "react";
import { formatDateTime } from "../lib/formatters";
import { getDisplayPreferences } from "../lib/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormAction = (formData: FormData) => Promise<any>;

export type EntityCommentsConfig = {
  /** Hidden form fields to identify the owning entity (e.g. assetId, householdId, hobbyId) */
  hiddenFields: Record<string, string>;
  createAction: FormAction;
  updateAction: FormAction;
  deleteAction: FormAction;
};

type CommentNodeProps = {
  config: EntityCommentsConfig;
  comment: ThreadedComment | ThreadedComment["replies"][number];
  allowReplies?: boolean;
  dateFormat?: DateFormat;
};

function CommentNode({ config, comment, allowReplies = false, dateFormat = "US" }: CommentNodeProps): JSX.Element {
  return (
    <article className="schedule-card">
      <div className="schedule-card__summary">
        <div>
          <h3 style={{ margin: 0, fontSize: "0.9375rem" }}>{comment.author.displayName ?? "Household member"}</h3>
          <p style={{ color: "var(--ink-muted)", fontSize: "0.8125rem", margin: "2px 0 0" }}>
            {formatDateTime(comment.createdAt, undefined, undefined, dateFormat)}
            {comment.editedAt ? ` · edited ${formatDateTime(comment.editedAt, undefined, undefined, dateFormat)}` : ""}
          </p>
        </div>
      </div>

      <p style={{ margin: "12px 0 16px", whiteSpace: "pre-wrap" }}>{comment.body}</p>

      <form action={config.updateAction} className="form-grid" style={{ marginBottom: 12 }}>
        {Object.entries(config.hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="commentId" value={comment.id} />
        <label className="field field--full">
          <span>Edit</span>
          <textarea name="body" rows={2} defaultValue={comment.body} required />
        </label>
        <button type="submit" className="button button--ghost">Save Edit</button>
      </form>

      {allowReplies && (
        <form action={config.createAction} className="form-grid" style={{ marginBottom: 12 }}>
          {Object.entries(config.hiddenFields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="parentCommentId" value={comment.id} />
          <label className="field field--full">
            <span>Reply</span>
            <textarea name="body" rows={2} placeholder="Add a threaded reply…" required />
          </label>
          <button type="submit" className="button button--primary">Reply</button>
        </form>
      )}

      <form action={config.deleteAction} className="inline-actions inline-actions--end">
        {Object.entries(config.hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="commentId" value={comment.id} />
        <button type="submit" className="button button--danger button--sm">Delete</button>
      </form>
    </article>
  );
}

type EntityCommentsProps = {
  comments: ThreadedComment[];
  config: EntityCommentsConfig;
  addCommentPlaceholder?: string;
};

export async function EntityComments({ comments, config, addCommentPlaceholder = "Leave a note, observation, or handoff for other household members…" }: EntityCommentsProps): Promise<JSX.Element> {
  const prefs = await getDisplayPreferences().catch(() => ({ pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" }));

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section className="panel">
        <div className="panel__header">
          <h2>New Comment</h2>
        </div>
        <div className="panel__body--padded">
          <form action={config.createAction} className="form-grid">
            {Object.entries(config.hiddenFields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <label className="field field--full">
              <span>Comment</span>
              <textarea name="body" rows={3} placeholder={addCommentPlaceholder} required />
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
            <div className="empty-state">
              <div className="empty-state__icon" aria-hidden="true">💬</div>
              <h3 className="empty-state__title">No comments yet</h3>
              <p className="empty-state__body">Start a discussion, leave a handoff note, or record an observation for other household members.</p>
            </div>
          ) : (
            <div className="schedule-stack">
              {comments.map((comment) => (
                <div key={comment.id}>
                  <CommentNode
                    config={config}
                    comment={comment}
                    allowReplies
                    dateFormat={prefs.dateFormat}
                  />
                  {comment.replies.length > 0 && (
                    <div style={{ display: "grid", gap: 12, marginTop: 18, paddingLeft: 18, borderLeft: "2px solid var(--border)" }}>
                      {comment.replies.map((reply) => (
                        <CommentNode
                          key={reply.id}
                          config={config}
                          comment={reply}
                          dateFormat={prefs.dateFormat}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
