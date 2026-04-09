import type { PresetScheduleTemplate } from "@aegis/types";
import type { JSX } from "react";
import { CompactSchedulePreview } from "./compact-schedule-preview";
import { ExpandableCard } from "./expandable-card";

type MetricDraft = {
  key: string;
  name: string;
  enabled: boolean;
};

type ScheduleDraft = {
  key: string;
  name: string;
  description?: string | undefined;
  tags: string[];
  enabled: boolean;
  lastCompletedAt: string;
  usageValue: string;
  triggerTemplate: PresetScheduleTemplate["triggerTemplate"];
  isRegulatory: boolean;
  notificationConfig: PresetScheduleTemplate["notificationConfig"];
  quickLogLabel?: string | undefined;
};

type MaintenanceSchedulesSectionProps = {
  isCreateMode: boolean;
  scheduleDrafts: ScheduleDraft[];
  scheduleTemplates: PresetScheduleTemplate[];
  metricDrafts: MetricDraft[];
  enabledMetricKeys: Set<string>;
  onAddScheduleDraft: () => void;
  onUpdateScheduleDraft: (index: number, update: Partial<ScheduleDraft>) => void;
  onSetScheduleTriggerTemplate: (index: number, triggerTemplate: PresetScheduleTemplate["triggerTemplate"]) => void;
  getScheduleMetricKey: (draft: ScheduleDraft) => string | undefined;
  createTriggerTemplate: (type: PresetScheduleTemplate["triggerTemplate"]["type"], metricKey?: string) => PresetScheduleTemplate["triggerTemplate"];
  toLocalDateTimeValue: (value?: string) => string;
  toOptionalIsoString: (value: string) => string | undefined;
  formatPresetTriggerSummary: (schedule: ScheduleDraft | PresetScheduleTemplate) => string;
};

export function AssetProfileWorkbenchMaintenanceSchedulesSection({
  isCreateMode,
  scheduleDrafts,
  scheduleTemplates,
  metricDrafts,
  enabledMetricKeys,
  onAddScheduleDraft,
  onUpdateScheduleDraft,
  onSetScheduleTriggerTemplate,
  getScheduleMetricKey,
  createTriggerTemplate,
  toLocalDateTimeValue,
  toOptionalIsoString,
  formatPresetTriggerSummary,
}: MaintenanceSchedulesSectionProps): JSX.Element {
  return (
    <ExpandableCard
      title="Maintenance Schedules"
      modalTitle="Schedule Templates"
      previewContent={<CompactSchedulePreview scheduleTemplates={scheduleTemplates} />}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap" }}>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem", margin: 0, flex: "1 1 320px" }}>
          {isCreateMode
            ? "Choose which preset schedules to create, rename them if needed, optionally record when they were last completed, or add your own schedules manually. Usage-based schedules can reference the metrics configured above."
            : "These template-derived schedules describe the preset profile. Live schedules are managed in the asset Maintenance tab."}
        </p>
        {isCreateMode ? <button type="button" className="button button--secondary button--sm" onClick={onAddScheduleDraft}>+ Add Schedule</button> : null}
      </div>
      {scheduleDrafts.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontStyle: "italic", fontSize: "0.88rem" }}>No schedules yet - select a template in Core Identity to populate these, or add one manually.</p>
      ) : (
        <div className="workbench-table-wrap">
          <table className="workbench-table">
            <thead>
              <tr>
                <th>Use</th>
                <th>Name</th>
                <th>Trigger</th>
                <th>Last Completed</th>
                <th>Usage at Completion</th>
              </tr>
            </thead>
            <tbody>
              {scheduleDrafts.map((draft, index) => {
                const availableMetricOptions = metricDrafts.filter((metricDraft) => metricDraft.enabled);
                const metricKey = getScheduleMetricKey(draft);
                const dependsOnDisabledMetric = metricKey ? !enabledMetricKeys.has(metricKey) : false;
                const isEnabled = draft.enabled && !dependsOnDisabledMetric;
                const intervalTrigger = draft.triggerTemplate.type === "interval" ? draft.triggerTemplate : undefined;
                const usageTrigger = draft.triggerTemplate.type === "usage" ? draft.triggerTemplate : undefined;
                const seasonalTrigger = draft.triggerTemplate.type === "seasonal" ? draft.triggerTemplate : undefined;
                const compoundTrigger = draft.triggerTemplate.type === "compound" ? draft.triggerTemplate : undefined;
                const oneTimeTrigger = draft.triggerTemplate.type === "one_time" ? draft.triggerTemplate : undefined;

                return (
                  <tr key={draft.key}>
                    <td className="workbench-table__checkbox">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        disabled={!isCreateMode || dependsOnDisabledMetric}
                        aria-label={`Use schedule ${draft.name}`}
                        onChange={(event) => onUpdateScheduleDraft(index, { enabled: event.target.checked })}
                      />
                    </td>
                    <td>
                      <div className="workbench-table__control">
                        <input
                          type="text"
                          value={draft.name}
                          disabled={!isCreateMode || !isEnabled}
                          onChange={(event) => onUpdateScheduleDraft(index, { name: event.target.value })}
                        />
                        {isCreateMode ? (
                          <input
                            type="text"
                            value={draft.description ?? ""}
                            disabled={!isEnabled}
                            placeholder="Optional description"
                            onChange={(event) => onUpdateScheduleDraft(index, { description: event.target.value.trim() || undefined })}
                          />
                        ) : null}
                        {metricKey ? (
                          <small className="workbench-table__hint">
                            Depends on usage metric: {metricKey}
                            {dependsOnDisabledMetric ? " — enable that metric to create this schedule." : ""}
                          </small>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="workbench-table__control">
                        <select
                          value={draft.triggerTemplate.type}
                          disabled={!isCreateMode || !isEnabled}
                          onChange={(event) => {
                            const nextType = event.target.value as PresetScheduleTemplate["triggerTemplate"]["type"];
                            const fallbackMetricKey = availableMetricOptions[0]?.key;
                            onSetScheduleTriggerTemplate(index, createTriggerTemplate(nextType, fallbackMetricKey));
                          }}
                        >
                          <option value="interval">Interval</option>
                          <option value="usage" disabled={availableMetricOptions.length === 0}>Usage</option>
                          <option value="seasonal">Seasonal</option>
                          <option value="compound" disabled={availableMetricOptions.length === 0}>Compound</option>
                          <option value="one_time">One Time</option>
                        </select>
                        {intervalTrigger ? (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
                            <label className="field"><span>Every Days</span><input type="number" min="1" step="1" value={intervalTrigger.intervalDays} disabled={!isEnabled} onChange={(event) => onSetScheduleTriggerTemplate(index, { type: "interval", intervalDays: Math.max(1, Number(event.target.value) || 1), leadTimeDays: intervalTrigger.leadTimeDays, ...(intervalTrigger.anchorDate ? { anchorDate: intervalTrigger.anchorDate } : {}) })} /></label>
                            <label className="field"><span>Lead Days</span><input type="number" min="0" step="1" value={intervalTrigger.leadTimeDays} disabled={!isEnabled} onChange={(event) => onSetScheduleTriggerTemplate(index, { type: "interval", intervalDays: intervalTrigger.intervalDays, leadTimeDays: Math.max(0, Number(event.target.value) || 0), ...(intervalTrigger.anchorDate ? { anchorDate: intervalTrigger.anchorDate } : {}) })} /></label>
                          </div>
                        ) : null}
                        {usageTrigger ? (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}>
                            <label className="field"><span>Metric</span><select value={usageTrigger.metricKey} disabled={!isEnabled || availableMetricOptions.length === 0} onChange={(event) => onSetScheduleTriggerTemplate(index, { type: "usage", metricKey: event.target.value, intervalValue: usageTrigger.intervalValue, leadTimeValue: usageTrigger.leadTimeValue })}>{availableMetricOptions.map((metricDraft) => <option key={metricDraft.key} value={metricDraft.key}>{metricDraft.name}</option>)}</select></label>
                            <label className="field"><span>Interval Value</span><input type="number" min="0.1" step="0.1" value={usageTrigger.intervalValue} disabled={!isEnabled} onChange={(event) => onSetScheduleTriggerTemplate(index, { type: "usage", metricKey: usageTrigger.metricKey, intervalValue: Math.max(0.1, Number(event.target.value) || 0.1), leadTimeValue: usageTrigger.leadTimeValue })} /></label>
                            <label className="field"><span>Lead Value</span><input type="number" min="0" step="0.1" value={usageTrigger.leadTimeValue} disabled={!isEnabled} onChange={(event) => onSetScheduleTriggerTemplate(index, { type: "usage", metricKey: usageTrigger.metricKey, intervalValue: usageTrigger.intervalValue, leadTimeValue: Math.max(0, Number(event.target.value) || 0) })} /></label>
                          </div>
                        ) : null}
                        {seasonalTrigger ? (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}>
                            <label className="field"><span>Month</span><input type="number" min="1" max="12" step="1" value={seasonalTrigger.month} disabled={!isEnabled} onChange={(event) => onSetScheduleTriggerTemplate(index, { type: "seasonal", month: Math.min(12, Math.max(1, Number(event.target.value) || 1)), day: seasonalTrigger.day, leadTimeDays: seasonalTrigger.leadTimeDays })} /></label>
                            <label className="field"><span>Day</span><input type="number" min="1" max="31" step="1" value={seasonalTrigger.day} disabled={!isEnabled} onChange={(event) => onSetScheduleTriggerTemplate(index, { type: "seasonal", month: seasonalTrigger.month, day: Math.min(31, Math.max(1, Number(event.target.value) || 1)), leadTimeDays: seasonalTrigger.leadTimeDays })} /></label>
                            <label className="field"><span>Lead Days</span><input type="number" min="0" step="1" value={seasonalTrigger.leadTimeDays} disabled={!isEnabled} onChange={(event) => onSetScheduleTriggerTemplate(index, { type: "seasonal", month: seasonalTrigger.month, day: seasonalTrigger.day, leadTimeDays: Math.max(0, Number(event.target.value) || 0) })} /></label>
                          </div>
                        ) : null}
                        {compoundTrigger ? (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
                            <label className="field"><span>Metric</span><select value={compoundTrigger.metricKey} disabled={!isEnabled || availableMetricOptions.length === 0} onChange={(event) => onSetScheduleTriggerTemplate(index, { type: "compound", metricKey: event.target.value, intervalDays: compoundTrigger.intervalDays, intervalValue: compoundTrigger.intervalValue, logic: compoundTrigger.logic, leadTimeDays: compoundTrigger.leadTimeDays, leadTimeValue: compoundTrigger.leadTimeValue })}>{availableMetricOptions.map((metricDraft) => <option key={metricDraft.key} value={metricDraft.key}>{metricDraft.name}</option>)}</select></label>
                            <label className="field"><span>Logic</span><select value={compoundTrigger.logic} disabled={!isEnabled} onChange={(event) => onSetScheduleTriggerTemplate(index, { type: "compound", metricKey: compoundTrigger.metricKey, intervalDays: compoundTrigger.intervalDays, intervalValue: compoundTrigger.intervalValue, logic: event.target.value as "whichever_first" | "whichever_last", leadTimeDays: compoundTrigger.leadTimeDays, leadTimeValue: compoundTrigger.leadTimeValue })}><option value="whichever_first">Whichever first</option><option value="whichever_last">Whichever last</option></select></label>
                            <label className="field"><span>Every Days</span><input type="number" min="1" step="1" value={compoundTrigger.intervalDays} disabled={!isEnabled} onChange={(event) => onSetScheduleTriggerTemplate(index, { type: "compound", metricKey: compoundTrigger.metricKey, intervalDays: Math.max(1, Number(event.target.value) || 1), intervalValue: compoundTrigger.intervalValue, logic: compoundTrigger.logic, leadTimeDays: compoundTrigger.leadTimeDays, leadTimeValue: compoundTrigger.leadTimeValue })} /></label>
                            <label className="field"><span>Usage Interval</span><input type="number" min="0.1" step="0.1" value={compoundTrigger.intervalValue} disabled={!isEnabled} onChange={(event) => onSetScheduleTriggerTemplate(index, { type: "compound", metricKey: compoundTrigger.metricKey, intervalDays: compoundTrigger.intervalDays, intervalValue: Math.max(0.1, Number(event.target.value) || 0.1), logic: compoundTrigger.logic, leadTimeDays: compoundTrigger.leadTimeDays, leadTimeValue: compoundTrigger.leadTimeValue })} /></label>
                            <label className="field"><span>Lead Days</span><input type="number" min="0" step="1" value={compoundTrigger.leadTimeDays} disabled={!isEnabled} onChange={(event) => onSetScheduleTriggerTemplate(index, { type: "compound", metricKey: compoundTrigger.metricKey, intervalDays: compoundTrigger.intervalDays, intervalValue: compoundTrigger.intervalValue, logic: compoundTrigger.logic, leadTimeDays: Math.max(0, Number(event.target.value) || 0), leadTimeValue: compoundTrigger.leadTimeValue })} /></label>
                            <label className="field"><span>Lead Value</span><input type="number" min="0" step="0.1" value={compoundTrigger.leadTimeValue} disabled={!isEnabled} onChange={(event) => onSetScheduleTriggerTemplate(index, { type: "compound", metricKey: compoundTrigger.metricKey, intervalDays: compoundTrigger.intervalDays, intervalValue: compoundTrigger.intervalValue, logic: compoundTrigger.logic, leadTimeDays: compoundTrigger.leadTimeDays, leadTimeValue: Math.max(0, Number(event.target.value) || 0) })} /></label>
                          </div>
                        ) : null}
                        {oneTimeTrigger ? (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
                            <label className="field"><span>Due At</span><input type="datetime-local" value={toLocalDateTimeValue(oneTimeTrigger.dueAt)} disabled={!isEnabled} onChange={(event) => { const nextDueAt = toOptionalIsoString(event.target.value); if (!nextDueAt) { return; } onSetScheduleTriggerTemplate(index, { type: "one_time", dueAt: nextDueAt, leadTimeDays: oneTimeTrigger.leadTimeDays }); }} /></label>
                            <label className="field"><span>Lead Days</span><input type="number" min="0" step="1" value={oneTimeTrigger.leadTimeDays} disabled={!isEnabled} onChange={(event) => onSetScheduleTriggerTemplate(index, { type: "one_time", dueAt: oneTimeTrigger.dueAt, leadTimeDays: Math.max(0, Number(event.target.value) || 0) })} /></label>
                          </div>
                        ) : null}
                        <small className="workbench-table__hint">{formatPresetTriggerSummary(draft)}</small>
                        {draft.tags.length > 0 ? <small className="workbench-table__hint">{draft.tags.join(", ")}</small> : null}
                      </div>
                    </td>
                    <td>
                      <input type="datetime-local" value={draft.lastCompletedAt} disabled={!isCreateMode || !isEnabled} onChange={(event) => onUpdateScheduleDraft(index, { lastCompletedAt: event.target.value })} />
                    </td>
                    <td>
                      {metricKey ? (
                        <input type="number" min="0" step="0.1" value={draft.usageValue} disabled={!isCreateMode || !isEnabled} placeholder="Optional" onChange={(event) => onUpdateScheduleDraft(index, { usageValue: event.target.value })} />
                      ) : (
                        <span style={{ color: "var(--ink-muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ExpandableCard>
  );
}