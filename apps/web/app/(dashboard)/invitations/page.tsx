import Link from "next/link";
import { Suspense, type JSX } from "react";
import { CopyTextButton } from "../../../components/copy-text-button";
import {
  acceptInvitationAction,
  createInvitationAction,
  revokeInvitationAction
} from "../../actions";
import { ApiError, getHouseholdInvitations, getMe } from "../../../lib/api";
import { formatDateTime } from "../../../lib/formatters";
import { PageHeader } from "../../../components/page-header";

type InvitationsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function InvitationsContent({ householdId, token }: { householdId: string; token: string }): Promise<JSX.Element> {
  let invitations;
  try {
    invitations = await getHouseholdInvitations(householdId);
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <PageHeader title="Invitations" />
          <div className="page-body">
            <div className="panel"><div className="panel__body--padded"><p>Failed to load invitations: {error.message}</p></div></div>
          </div>
        </>
      );
    }
    throw error;
  }

    return (
      <>
        <PageHeader
          title="Household Invitations"
          subtitle="Invite members by email, share the generated token manually, and track pending or accepted invites."
        />

        <div className="page-body" style={{ display: "grid", gap: "24px" }}>
          <section className="panel">
            <div className="panel__header">
              <h2>Accept Invitation</h2>
            </div>
            <div className="panel__body--padded">
              <form action={acceptInvitationAction} className="form-grid">
                <label className="field field--full">
                  <span>Invitation Token</span>
                  <input type="text" name="token" defaultValue={token} placeholder="Paste token from the shared invite link" required />
                </label>
                <button type="submit" className="button button--primary">Accept Invitation</button>
              </form>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Create Invitation</h2>
            </div>
            <div className="panel__body--padded">
              <form action={createInvitationAction} className="form-grid">
                <input type="hidden" name="householdId" value={householdId} />
                <label className="field">
                  <span>Email</span>
                  <input type="email" name="email" placeholder="member@example.com" required />
                </label>
                <label className="field">
                  <span>Expiration Hours</span>
                  <input type="number" name="expirationHours" min="1" max="720" step="1" defaultValue="72" />
                </label>
                <button type="submit" className="button button--primary">Create Invitation</button>
              </form>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>All Invitations ({invitations.length})</h2>
            </div>
            <div className="panel__body">
              {invitations.length === 0 ? (
                <p className="panel__empty">No invitations created yet.</p>
              ) : (
                <div className="schedule-stack">
                  {invitations.map((invitation) => (
                    <article key={invitation.id} className="schedule-card">
                      <div className="schedule-card__summary">
                        <div>
                          <h3>{invitation.email}</h3>

                          <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                            Created {formatDateTime(invitation.createdAt)} • Expires {formatDateTime(invitation.expiresAt)}
                          </p>
                        </div>
                        <span className="pill">{invitation.status}</span>
                      </div>
                      <dl className="data-list">
                        <div>
                          <dt>Token</dt>
                          <dd style={{ display: "grid", gap: 8 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                              <span style={{ wordBreak: "break-all", flex: "1 1 24rem" }}>{invitation.token}</span>
                              <CopyTextButton value={invitation.token} label="Copy Token" copiedLabel="Token Copied" />
                            </div>
                          </dd>
                        </div>
                        <div><dt>Accepted At</dt><dd>{invitation.acceptedAt ? formatDateTime(invitation.acceptedAt) : "Not accepted"}</dd></div>
                      </dl>
                      {invitation.status === "pending" ? (
                        <form action={revokeInvitationAction} className="inline-actions inline-actions--end" style={{ marginTop: "16px" }}>
                          <input type="hidden" name="householdId" value={householdId} />
                          <input type="hidden" name="invitationId" value={invitation.id} />
                          <button type="submit" className="button button--danger">Revoke Invitation</button>
                        </form>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </>
    );
}

export default async function InvitationsPage({ searchParams }: InvitationsPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};
  const householdIdParam = typeof params.householdId === "string" ? params.householdId : undefined;
  const token = typeof params.token === "string" ? params.token : "";

  const me = await getMe();
  const household = me.households.find((item) => item.id === householdIdParam) ?? me.households[0];

  if (!household) {
    return (
      <>
        <PageHeader title="Invitations" />
        <div className="page-body">
          <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
        </div>
      </>
    );
  }

  return (
    <Suspense fallback={<><PageHeader title="Invitations" /><div className="page-body"><section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1,2,3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section></div></>}>
      <InvitationsContent householdId={household.id} token={token} />
    </Suspense>
  );
}