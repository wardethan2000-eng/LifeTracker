import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import {
  createProcedureAction,
  deleteProcedureAction,
} from "../../actions";
import { ApiError, getHouseholdProcedures, getMe } from "../../../lib/api";
import { PageHeader } from "../../../components/page-header";
import { EmptyState } from "../../../components/empty-state";

async function ProceduresContent({ householdId }: { householdId: string }): Promise<JSX.Element> {
  let procedures;
  try {
    procedures = await getHouseholdProcedures(householdId);
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded"><p>Failed to load procedures: {error.message}</p></div>
        </div>
      );
    }
    throw error;
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Procedures ({procedures.length})</h2>
      </div>
      <div className="panel__body">
        {procedures.length === 0 ? (
          <EmptyState
            icon="clipboard-list"
            title="No procedures yet"
            message="Create step-by-step procedures for maintenance tasks, installations, and repairs."
          />
        ) : (
          <div className="schedule-stack">
            {procedures.map((proc) => (
              <div key={proc.id} className="schedule-card">
                <div className="schedule-card__main">
                  <div className="schedule-card__info">
                    <strong>{proc.title}</strong>
                    {proc.description && <p className="note">{proc.description}</p>}
                    <div className="schedule-card__meta" style={{ display: "flex", gap: 12, marginTop: 4 }}>
                      {proc.stepCount > 0 && <span className="note">{proc.stepCount} step{proc.stepCount !== 1 ? "s" : ""}</span>}
                      {proc.estimatedMinutes && <span className="note">~{proc.estimatedMinutes} min</span>}
                    </div>
                  </div>
                  <div className="schedule-card__actions" style={{ display: "flex", gap: 8 }}>
                    <Link href={`/procedures/${proc.id}?householdId=${householdId}`} className="button button--ghost button--xs">View</Link>
                    <form action={deleteProcedureAction}>
                      <input type="hidden" name="householdId" value={householdId} />
                      <input type="hidden" name="procedureId" value={proc.id} />
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
  );
}

export default async function ProceduresPage(): Promise<JSX.Element> {
  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return (
      <>
        <PageHeader title="Procedures" />
        <div className="page-body">
          <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Procedures"
        subtitle="Step-by-step guides for maintenance, repairs, and inspections."
      />
      <div className="page-body">
        <section className="panel">
          <div className="panel__header"><h2>Create Procedure</h2></div>
          <div className="panel__body--padded">
            <form action={createProcedureAction}>
              <input type="hidden" name="householdId" value={household.id} />
              <div className="form-grid">
                <label className="field"><span>Title</span><input type="text" name="title" placeholder="e.g. Oil Change — Lawn Mower" required /></label>
                <label className="field"><span>Est. Minutes</span><input type="number" name="estimatedMinutes" min="1" step="1" placeholder="30" /></label>
                <label className="field field--full"><span>Description</span><textarea name="description" rows={2} placeholder="When and why to use this procedure..." /></label>
              </div>
              <div className="inline-actions" style={{ marginTop: 20 }}>
                <button type="submit" className="button">Create Procedure</button>
              </div>
            </form>
          </div>
        </section>

        <Suspense fallback={<section className="panel"><div className="panel__body--padded"><p className="note">Loading…</p></div></section>}>
          <ProceduresContent householdId={household.id} />
        </Suspense>
      </div>
    </>
  );
}
