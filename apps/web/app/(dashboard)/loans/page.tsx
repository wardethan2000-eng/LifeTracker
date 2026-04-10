import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import {
  createLoanAction,
  updateLoanAction,
  deleteLoanAction,
} from "../../actions";
import { ApiError, getHouseholdLoans, getMe } from "../../../lib/api";
import { PageHeader } from "../../../components/page-header";
import { EmptyState } from "../../../components/empty-state";
import { formatDate } from "../../../lib/formatters";

async function LoansContent({ householdId }: { householdId: string }): Promise<JSX.Element> {
  let loans;
  try {
    loans = await getHouseholdLoans(householdId, "all");
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded"><p>Failed to load loans: {error.message}</p></div>
        </div>
      );
    }
    throw error;
  }

  const active = loans.filter((l) => l.returnedAt === null);
  const returned = loans.filter((l) => l.returnedAt !== null);

  return (
    <>
      <section className="panel">
        <div className="panel__header">
          <h2>Active ({active.length})</h2>
        </div>
        <div className="panel__body">
          {active.length === 0 ? (
            <EmptyState icon="arrow-swap" title="No active loans" message="Nothing is currently lent out or borrowed." />
          ) : (
            <div className="schedule-stack">
              {active.map((loan) => (
                <div key={loan.id} className="schedule-card">
                  <div className="schedule-card__main">
                    <div className="schedule-card__info">
                      <strong>{loan.entityName ?? loan.entityId}</strong>
                      <span className="note">
                        To: {loan.borrowerName}
                      </span>
                      <span className="note">Since {formatDate(loan.lentAt)}</span>
                      {loan.expectedReturnAt && (
                        <span className="note">Expected back: {formatDate(loan.expectedReturnAt)}</span>
                      )}
                      {loan.notes && <p className="note">{loan.notes}</p>}
                    </div>
                    <div className="schedule-card__actions" style={{ display: "flex", gap: 8 }}>
                      <form action={updateLoanAction}>
                        <input type="hidden" name="householdId" value={householdId} />
                        <input type="hidden" name="loanId" value={loan.id} />
                        <input type="hidden" name="returnedAt" value={new Date().toISOString()} />
                        <button type="submit" className="button button--ghost button--xs">Mark Returned</button>
                      </form>
                      <form action={deleteLoanAction}>
                        <input type="hidden" name="householdId" value={householdId} />
                        <input type="hidden" name="loanId" value={loan.id} />
                        <button type="submit" className="button button--ghost button--xs">Delete</button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {returned.length > 0 && (
        <section className="panel">
          <div className="panel__header">
            <h2>Returned ({returned.length})</h2>
          </div>
          <div className="panel__body">
            <div className="schedule-stack">
              {returned.map((loan) => (
                <div key={loan.id} className="schedule-card" style={{ opacity: 0.7 }}>
                  <div className="schedule-card__main">
                    <div className="schedule-card__info">
                      <strong>{loan.entityName ?? loan.entityId}</strong>
                      <span className="note">{loan.borrowerName}</span>
                      <span className="note">
                        {formatDate(loan.lentAt)} → {loan.returnedAt ? formatDate(loan.returnedAt) : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

export default async function LoansPage(): Promise<JSX.Element> {
  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return (
      <>
        <PageHeader title="Loans" />
        <div className="page-body">
          <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Loans"
        subtitle="Track items lent out or borrowed — never lose track of who has what."
      />
      <div className="page-body">
        <section className="panel">
          <div className="panel__header"><h2>Record a Loan</h2></div>
          <div className="panel__body--padded">
            <form action={createLoanAction}>
              <input type="hidden" name="householdId" value={household.id} />
              <div className="form-grid">
                <label className="field">
                  <span>Type</span>
                  <select name="entityType" required>
                    <option value="asset">Asset</option>
                    <option value="inventory_item">Inventory Item</option>
                  </select>
                </label>
                <label className="field"><span>Entity ID</span><input type="text" name="entityId" required placeholder="Paste asset or item ID" /></label>
                <label className="field"><span>Person</span><input type="text" name="borrowerName" required placeholder="Name of borrower / lender" /></label>
                <label className="field"><span>Date</span><input type="date" name="lentAt" /></label>
                <label className="field"><span>Expected Return</span><input type="date" name="expectedReturnAt" /></label>
                <label className="field field--full"><span>Notes</span><textarea name="notes" rows={2} placeholder="Condition notes, reminders..." /></label>
              </div>
              <div className="inline-actions" style={{ marginTop: 20 }}>
                <button type="submit" className="button">Record Loan</button>
              </div>
            </form>
          </div>
        </section>

        <Suspense fallback={<section className="panel"><div className="panel__body--padded"><p className="note">Loading…</p></div></section>}>
          <LoansContent householdId={household.id} />
        </Suspense>
      </div>
    </>
  );
}
