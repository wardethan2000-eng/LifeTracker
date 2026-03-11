"use client";

import type { JSX } from "react";
import { useState } from "react";

type ScheduleCardActionsProps = {
  assetId: string;
  scheduleId: string;
  scheduleName: string;
  isActive: boolean;
  completeAction: (formData: FormData) => void | Promise<void>;
  toggleAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
};

export function ScheduleCardActions({
  assetId,
  scheduleId,
  scheduleName,
  isActive,
  completeAction,
  toggleAction,
  deleteAction
}: ScheduleCardActionsProps): JSX.Element {
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div className="schedule-card__actions-area">
      <div className="inline-actions">
        <button type="button" className={`button button--primary button--sm${showForm ? " button--active" : ""}`} onClick={() => { setShowForm(!showForm); setShowDelete(false); }}>
          {showForm ? "Cancel" : "Log Completion"}
        </button>
        <form action={toggleAction}>
          <input type="hidden" name="assetId" value={assetId} />
          <input type="hidden" name="scheduleId" value={scheduleId} />
          <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />
          <button type="submit" className="button button--ghost button--sm">
            {isActive ? "Pause" : "Resume"}
          </button>
        </form>
        {!showDelete ? (
          <button type="button" className="button button--danger button--sm" onClick={() => { setShowDelete(true); setShowForm(false); }}>
            Delete
          </button>
        ) : (
          <form action={deleteAction} className="schedule-card__delete-confirm">
            <input type="hidden" name="assetId" value={assetId} />
            <input type="hidden" name="scheduleId" value={scheduleId} />
            <span style={{ fontSize: "0.82rem", color: "var(--danger)" }}>Confirm delete?</span>
            <button type="submit" className="button button--danger button--sm">Yes, delete</button>
            <button type="button" className="button button--ghost button--sm" onClick={() => setShowDelete(false)}>No</button>
          </form>
        )}
      </div>

      {showForm && (
        <form action={completeAction} className="form-grid schedule-card__complete-form">
          <input type="hidden" name="assetId" value={assetId} />
          <input type="hidden" name="scheduleId" value={scheduleId} />
          <label className="field">
            <span>Log title</span>
            <input type="text" name="title" placeholder={scheduleName} />
          </label>
          <label className="field">
            <span>Completed at</span>
            <input type="datetime-local" name="completedAt" />
          </label>
          <label className="field">
            <span>Usage reading</span>
            <input type="number" name="usageValue" min="0" step="0.1" placeholder="Current meter value" />
          </label>
          <label className="field">
            <span>Cost ($)</span>
            <input type="number" name="cost" min="0" step="0.01" placeholder="0.00" />
          </label>
          <label className="field field--full">
            <span>Notes</span>
            <textarea name="notes" rows={3} placeholder="Parts used, vendor, findings, or follow-up needed" />
          </label>
          <div className="field field--full inline-actions inline-actions--end">
            <button type="submit" className="button button--primary">Save Completion</button>
          </div>
        </form>
      )}
    </div>
  );
}
