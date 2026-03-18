import type { PresetUsageMetricTemplate } from "@lifekeeper/types";
import type { JSX } from "react";
import { CompactMetricPreview } from "./compact-metric-preview";
import { ExpandableCard } from "./expandable-card";

type MetricDraft = {
  key: string;
  name: string;
  helpText?: string | undefined;
  unit: string;
  enabled: boolean;
  currentValue: number;
  lastRecordedAt: string;
};

type UsageMetricsSectionProps = {
  isCreateMode: boolean;
  metricDrafts: MetricDraft[];
  metricTemplates: PresetUsageMetricTemplate[];
  onAddMetricDraft: () => void;
  onUpdateMetricDraft: (index: number, update: Partial<MetricDraft>) => void;
  onToggleMetricEnabled: (index: number, enabled: boolean, metricKey: string) => void;
};

export function AssetProfileWorkbenchUsageMetricsSection({
  isCreateMode,
  metricDrafts,
  metricTemplates,
  onAddMetricDraft,
  onUpdateMetricDraft,
  onToggleMetricEnabled,
}: UsageMetricsSectionProps): JSX.Element {
  return (
    <ExpandableCard
      title="Usage Metrics"
      modalTitle="Usage Metric Templates"
      previewContent={<CompactMetricPreview metricTemplates={metricTemplates} />}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap" }}>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem", margin: 0, flex: "1 1 320px" }}>
          {isCreateMode
            ? "Choose which preset metrics to track and set their initial readings before the asset is created, or add your own metrics manually."
            : "These template-derived metrics describe the preset profile. Live readings are managed in the asset Usage Metrics tab."}
        </p>
        {isCreateMode ? <button type="button" className="button button--secondary button--sm" onClick={onAddMetricDraft}>+ Add Metric</button> : null}
      </div>
      {metricDrafts.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontStyle: "italic", fontSize: "0.88rem" }}>No metrics yet - select a template in Core Identity to populate these, or add one manually.</p>
      ) : (
        <div className="workbench-table-wrap">
          <table className="workbench-table">
            <thead>
              <tr>
                <th>Use</th>
                <th>Metric</th>
                <th>Unit</th>
                <th>Current Value</th>
                <th>Recorded At</th>
              </tr>
            </thead>
            <tbody>
              {metricDrafts.map((draft, index) => (
                <tr key={draft.key}>
                  <td className="workbench-table__checkbox">
                    <input
                      type="checkbox"
                      checked={draft.enabled}
                      disabled={!isCreateMode}
                      aria-label={`Use metric ${draft.name}`}
                      onChange={(event) => onToggleMetricEnabled(index, event.target.checked, draft.key)}
                    />
                  </td>
                  <td>
                    <div className="workbench-table__control">
                      <input
                        type="text"
                        value={draft.name}
                        disabled={!isCreateMode || !draft.enabled}
                        onChange={(event) => onUpdateMetricDraft(index, { name: event.target.value })}
                      />
                      {isCreateMode ? (
                        <input
                          type="text"
                          value={draft.helpText ?? ""}
                          disabled={!draft.enabled}
                          placeholder="Optional help text"
                          onChange={(event) => onUpdateMetricDraft(index, { helpText: event.target.value.trim() || undefined })}
                        />
                      ) : null}
                      {draft.helpText ? <small className="workbench-table__hint">{draft.helpText}</small> : null}
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={draft.unit}
                      disabled={!isCreateMode || !draft.enabled}
                      onChange={(event) => onUpdateMetricDraft(index, { unit: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={draft.currentValue}
                      disabled={!isCreateMode || !draft.enabled}
                      onChange={(event) => onUpdateMetricDraft(index, { currentValue: event.target.value === "" ? 0 : Number(event.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="datetime-local"
                      value={draft.lastRecordedAt}
                      disabled={!isCreateMode || !draft.enabled}
                      onChange={(event) => onUpdateMetricDraft(index, { lastRecordedAt: event.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ExpandableCard>
  );
}