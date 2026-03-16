"use client";

import type { ScheduleInventoryLinkDetail } from "@lifekeeper/types";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { getScheduleInventoryItems } from "../lib/api";

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
  const [linkedParts, setLinkedParts] = useState<ScheduleInventoryLinkDetail[]>([]);
  const [linkedPartsLoaded, setLinkedPartsLoaded] = useState(false);
  const [linkedPartsError, setLinkedPartsError] = useState<string | null>(null);
  const [applyLinkedParts, setApplyLinkedParts] = useState(true);

  useEffect(() => {
    if (!showForm || linkedPartsLoaded) {
      return;
    }

    let cancelled = false;

    const loadLinkedParts = async (): Promise<void> => {
      try {
        const nextLinkedParts = await getScheduleInventoryItems(assetId, scheduleId);

        if (cancelled) {
          return;
        }

        setLinkedParts(nextLinkedParts);
        setApplyLinkedParts(nextLinkedParts.length > 0);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLinkedParts([]);
        setApplyLinkedParts(false);
        setLinkedPartsError(error instanceof Error ? error.message : "Failed to load linked parts.");
      } finally {
        if (!cancelled) {
          setLinkedPartsLoaded(true);
        }
      }
    };

    void loadLinkedParts();

    return () => {
      cancelled = true;
    };
  }, [assetId, linkedPartsLoaded, scheduleId, showForm]);

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
          <input type="hidden" name="applyLinkedParts" value={applyLinkedParts ? "true" : "false"} />
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
          {linkedParts.length > 0 ? (
            <div className="field field--full schedule-card__linked-parts">
              <label className="schedule-card__linked-parts-toggle">
                <input
                  type="checkbox"
                  checked={applyLinkedParts}
                  onChange={(event) => setApplyLinkedParts(event.target.checked)}
                />
                <span>Consume linked required parts and add them to this log</span>
              </label>
              <div className="schedule-card__linked-parts-summary">
                {linkedParts.map((part) => (
                  <div key={part.id} className="schedule-card__linked-part-row">
                    <div>
                      <strong>{part.inventoryItem.name}</strong>
                      <span>{part.inventoryItem.partNumber ?? "No part number"}</span>
                    </div>
                    <span>{part.quantityPerService} {part.inventoryItem.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {linkedPartsError ? (
            <p className="field field--full schedule-card__linked-parts-error">{linkedPartsError}</p>
          ) : null}
          <div className="field field--full inline-actions inline-actions--end">
            <button type="submit" className="button button--primary">Save Completion</button>
          </div>
        </form>
      )}
    </div>
  );
}
