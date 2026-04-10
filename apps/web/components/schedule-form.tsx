"use client";

import type { JSX } from "react";
import { useState, useTransition } from "react";

type Metric = {
  id: string;
  name: string;
  unit: string;
};

type ProcedureOption = {
  id: string;
  title: string;
};

type ScheduleFormProps = {
  assetId: string;
  metrics: Metric[];
  procedures?: ProcedureOption[];
  action: (formData: FormData) => void | Promise<void>;
};

type TriggerType = "interval" | "usage" | "seasonal" | "compound" | "one_time";

const triggerDescriptions: Record<TriggerType, string> = {
  interval: "Repeats on a fixed calendar cadence — e.g. every 90 days, every 6 months.",
  usage: "Triggers based on a tracked metric — e.g. every 5,000 miles or 200 engine hours.",
  seasonal: "Due at the same date every year — e.g. winterize on October 15.",
  compound: "Combines time + usage — e.g. every 6 months OR every 5,000 miles, whichever comes first.",
  one_time: "A single upcoming task with a fixed due date — e.g. warranty inspection by March 2027."
};

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function ScheduleForm({ assetId, metrics, procedures, action }: ScheduleFormProps): JSX.Element {
  const [triggerType, setTriggerType] = useState<TriggerType>("interval");
  const [channels, setChannels] = useState<Set<string>>(new Set(["push"]));
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const needsMetric = triggerType === "usage" || triggerType === "compound";
  const hasMetrics = metrics.length > 0;

  const toggleChannel = (channel: string): void => {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) next.delete(channel);
      else next.add(channel);
      return next;
    });
  };

  if (!expanded) {
    return (
      <div className="panel__body--padded" style={{ textAlign: "center" }}>
        <button type="button" className="button button--primary" onClick={() => setExpanded(true)}>
          + New Maintenance Schedule
        </button>
      </div>
    );
  }

  return (
    <div className="panel__body--padded">
      <form
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            try {
              await action(formData);
              setExpanded(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to create schedule. Please try again.");
            }
          });
        }}
        className="form-grid"
      >
        <input type="hidden" name="assetId" value={assetId} />

        {/* ── Identity ── */}
        <label className="field field--full">
          <span>Schedule name</span>
          <input type="text" name="name" placeholder="Oil change, brake inspection, filter replacement…" required />
        </label>
        <label className="field field--full">
          <span>Description</span>
          <textarea name="description" rows={2} placeholder="What should be done and any special instructions" />
        </label>

        {/* ── Trigger Type ── */}
        <div className="field field--full">
          <span className="schedule-form__section-label">Trigger type</span>
          <div className="schedule-form__trigger-grid">
            {(["interval", "usage", "seasonal", "compound", "one_time"] as TriggerType[]).map((t) => (
              <label key={t} className={`schedule-form__trigger-option${triggerType === t ? " schedule-form__trigger-option--active" : ""}`}>
                <input
                  type="radio"
                  name="triggerType"
                  value={t}
                  checked={triggerType === t}
                  onChange={() => setTriggerType(t)}
                />
                <strong>{t === "one_time" ? "One-time" : t.charAt(0).toUpperCase() + t.slice(1)}</strong>
              </label>
            ))}
          </div>
          <small className="schedule-form__trigger-hint">{triggerDescriptions[triggerType]}</small>
        </div>

        {/* ── Metric warning ── */}
        {needsMetric && !hasMetrics && (
          <div className="field field--full">
            <div className="schedule-form__warning">
              This trigger type requires a usage metric (like an odometer or hour meter). Add a metric to this asset first, then create the schedule.
            </div>
          </div>
        )}

        {/* ── Interval fields ── */}
        {triggerType === "interval" && (
          <>
            <label className="field">
              <span>Repeat every</span>
              <div className="schedule-form__input-unit">
                <input type="number" name="intervalDays" min="1" step="1" placeholder="90" required />
                <span>days</span>
              </div>
              <small>How often this maintenance recurs.</small>
            </label>
            <label className="field">
              <span>Notify before</span>
              <div className="schedule-form__input-unit">
                <input type="number" name="leadTimeDays" min="0" step="1" placeholder="7" defaultValue="7" />
                <span>days</span>
              </div>
              <small>Advance warning before the task is due.</small>
            </label>
          </>
        )}

        {/* ── Usage fields ── */}
        {triggerType === "usage" && hasMetrics && (
          <>
            <label className="field">
              <span>Tracked metric</span>
              <select name="metricId" required>
                <option value="">Select a metric</option>
                {metrics.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Every</span>
              <div className="schedule-form__input-unit">
                <input type="number" name="intervalValue" min="1" step="0.1" placeholder="5000" required />
                <span>units</span>
              </div>
              <small>Interval in the metric&rsquo;s unit (miles, hours, etc.).</small>
            </label>
            <label className="field">
              <span>Notify before</span>
              <div className="schedule-form__input-unit">
                <input type="number" name="leadTimeValue" min="0" step="0.1" placeholder="250" defaultValue="250" />
                <span>units</span>
              </div>
              <small>Advance warning in metric units.</small>
            </label>
          </>
        )}

        {/* ── Seasonal fields ── */}
        {triggerType === "seasonal" && (
          <>
            <label className="field">
              <span>Month</span>
              <select name="month" required>
                <option value="">Select month</option>
                {monthNames.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Day of month</span>
              <input type="number" name="day" min="1" max="31" step="1" placeholder="15" required />
            </label>
            <label className="field">
              <span>Notify before</span>
              <div className="schedule-form__input-unit">
                <input type="number" name="leadTimeDays" min="0" step="1" placeholder="14" defaultValue="14" />
                <span>days</span>
              </div>
              <small>Advance warning before the seasonal date.</small>
            </label>
          </>
        )}

        {/* ── Compound fields ── */}
        {triggerType === "compound" && hasMetrics && (
          <>
            <label className="field">
              <span>Tracked metric</span>
              <select name="metricId" required>
                <option value="">Select a metric</option>
                {metrics.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Time interval</span>
              <div className="schedule-form__input-unit">
                <input type="number" name="intervalDays" min="1" step="1" placeholder="180" required />
                <span>days</span>
              </div>
            </label>
            <label className="field">
              <span>Usage interval</span>
              <div className="schedule-form__input-unit">
                <input type="number" name="intervalValue" min="1" step="0.1" placeholder="5000" required />
                <span>units</span>
              </div>
            </label>
            <label className="field">
              <span>Trigger logic</span>
              <select name="logic" defaultValue="whichever_first">
                <option value="whichever_first">Whichever comes first</option>
                <option value="whichever_last">Whichever comes last (both must pass)</option>
              </select>
              <small>&ldquo;Whichever first&rdquo; is safer — the task fires as soon as either threshold is reached.</small>
            </label>
            <label className="field">
              <span>Lead time (days)</span>
              <input type="number" name="leadTimeDays" min="0" step="1" placeholder="7" defaultValue="7" />
            </label>
            <label className="field">
              <span>Lead time (units)</span>
              <input type="number" name="leadTimeValue" min="0" step="0.1" placeholder="250" defaultValue="250" />
            </label>
          </>
        )}

        {/* ── One-time fields ── */}
        {triggerType === "one_time" && (
          <>
            <label className="field">
              <span>Due date</span>
              <input type="datetime-local" name="dueAt" required />
              <small>Exact date and time this one-time task must be completed by.</small>
            </label>
            <label className="field">
              <span>Notify before</span>
              <div className="schedule-form__input-unit">
                <input type="number" name="leadTimeDays" min="0" step="1" placeholder="7" defaultValue="7" />
                <span>days</span>
              </div>
            </label>
          </>
        )}

        {/* ── Notification Config ── */}
        <div className="field field--full">
          <span className="schedule-form__section-label">Notifications</span>
          <div className="schedule-form__channel-row">
            <label className={`schedule-form__channel-chip${channels.has("push") ? " schedule-form__channel-chip--active" : ""}`}>
              <input type="checkbox" name="channel_push" checked={channels.has("push")} onChange={() => toggleChannel("push")} />
              Push
            </label>
            <label className={`schedule-form__channel-chip${channels.has("email") ? " schedule-form__channel-chip--active" : ""}`}>
              <input type="checkbox" name="channel_email" checked={channels.has("email")} onChange={() => toggleChannel("email")} />
              Email
            </label>
            <label className={`schedule-form__channel-chip${channels.has("digest") ? " schedule-form__channel-chip--active" : ""}`}>
              <input type="checkbox" name="channel_digest" checked={channels.has("digest")} onChange={() => toggleChannel("digest")} />
              Weekly Digest
            </label>
          </div>
          <input type="hidden" name="digest" value={channels.has("digest") ? "on" : ""} />
        </div>

        <label className="field">
          <span>Estimated Cost</span>
          <input type="number" name="estimatedCost" min="0" step="0.01" placeholder="Cost per occurrence" />
        </label>

        <label className="field">
          <span>Estimated Time (minutes)</span>
          <input type="number" name="estimatedMinutes" min="0" step="1" placeholder="Minutes per occurrence" />
        </label>

        {procedures && procedures.length > 0 ? (
          <label className="field field--full">
            <span>Linked Procedure</span>
            <select name="procedureId">
              <option value="">None</option>
              {procedures.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="field field--full inline-actions inline-actions--end">
          <button type="button" className="button button--ghost" onClick={() => setExpanded(false)} disabled={isPending}>Cancel</button>
          <button type="submit" className="button button--primary" disabled={isPending || (needsMetric && !hasMetrics)}>
            {isPending ? "Creating…" : "Create Schedule"}
          </button>
        </div>
        {error ? <p className="form-error field field--full">{error}</p> : null}
      </form>
    </div>
  );
}
