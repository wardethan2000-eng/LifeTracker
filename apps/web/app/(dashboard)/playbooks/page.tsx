import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import {
  createPlaybookAction,
  deletePlaybookAction,
} from "../../actions";
import { ApiError, getHouseholdPlaybooks, getMe } from "../../../lib/api";
import { PageHeader } from "../../../components/page-header";
import { EmptyState } from "../../../components/empty-state";

const monthLabels: Record<number, string> = {
  1: "January", 2: "February", 3: "March", 4: "April",
  5: "May", 6: "June", 7: "July", 8: "August",
  9: "September", 10: "October", 11: "November", 12: "December"
};

async function PlaybooksContent({ householdId }: { householdId: string }): Promise<JSX.Element> {
  let playbooks;
  try {
    playbooks = await getHouseholdPlaybooks(householdId);
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded"><p>Failed to load playbooks: {error.message}</p></div>
        </div>
      );
    }
    throw error;
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Playbooks ({playbooks.length})</h2>
      </div>
      <div className="panel__body">
        {playbooks.length === 0 ? (
          <EmptyState
            icon="calendar-check"
            title="No playbooks yet"
            message="Create seasonal checklists to stay on top of recurring household and asset tasks."
          />
        ) : (
          <div className="schedule-stack">
            {playbooks.map((pb) => (
              <div key={pb.id} className="schedule-card">
                <div className="schedule-card__main">
                  <div className="schedule-card__info">
                    <strong>{pb.title}</strong>
                    {pb.description && <p className="note">{pb.description}</p>}
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      {pb.triggerMonth && <span className="pill pill--info">📅 {monthLabels[pb.triggerMonth]}{pb.triggerDay ? ` ${pb.triggerDay}` : ""}</span>}
                      <span className="note">{pb.itemCount} item{pb.itemCount !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div className="schedule-card__actions" style={{ display: "flex", gap: 8 }}>
                    <Link href={`/playbooks/${pb.id}?householdId=${householdId}`} className="button button--ghost button--xs">View</Link>
                    <form action={deletePlaybookAction}>
                      <input type="hidden" name="householdId" value={householdId} />
                      <input type="hidden" name="playbookId" value={pb.id} />
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

export default async function PlaybooksPage(): Promise<JSX.Element> {
  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return (
      <>
        <PageHeader title="Playbooks" />
        <div className="page-body">
          <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Playbooks"
        subtitle="Seasonal checklists and recurring task playbooks for your household."
      />
      <div className="page-body">
        <section className="panel">
          <div className="panel__header"><h2>Create Playbook</h2></div>
          <div className="panel__body--padded">
            <form action={createPlaybookAction}>
              <input type="hidden" name="householdId" value={household.id} />
              <div className="form-grid">
                <label className="field"><span>Title</span><input type="text" name="title" placeholder="e.g. Spring Home Readiness" required /></label>
                <label className="field">
                  <span>Trigger Month</span>
                  <select name="triggerMonth">
                    <option value="">Any time</option>
                    <option value="1">January</option>
                    <option value="2">February</option>
                    <option value="3">March</option>
                    <option value="4">April</option>
                    <option value="5">May</option>
                    <option value="6">June</option>
                    <option value="7">July</option>
                    <option value="8">August</option>
                    <option value="9">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                  </select>
                </label>
                <label className="field field--full"><span>Description</span><textarea name="description" rows={2} placeholder="What this playbook covers..." /></label>
              </div>
              <div className="inline-actions" style={{ marginTop: 20 }}>
                <button type="submit" className="button">Create Playbook</button>
              </div>
            </form>
          </div>
        </section>

        <Suspense fallback={<section className="panel"><div className="panel__body--padded"><p className="note">Loading…</p></div></section>}>
          <PlaybooksContent householdId={household.id} />
        </Suspense>
      </div>
    </>
  );
}
