import type { AssetDetailResponse, CustomPresetProfile, LibraryPreset } from "@aegis/types";
import type { JSX } from "react";
import {
  applyPresetToAssetAction,
  recordConditionAssessmentAction
} from "../app/actions";
import {
  formatCategoryLabel,
  formatDateTime
} from "../lib/formatters";
import { getDisplayPreferences } from "../lib/api";
import {
  AssetInsuranceDetailsCard,
  AssetLocationDetailsCard,
  AssetPurchaseDetailsCard,
  AssetWarrantyDetailsCard,
} from "./asset-details-cards";

type AssetDetailsTabProps = {
  detail: AssetDetailResponse;
  assetId: string;
  libraryPresets: LibraryPreset[];
  customPresets: CustomPresetProfile[];
};

export async function AssetDetailsTab({ detail, assetId, libraryPresets, customPresets }: AssetDetailsTabProps): Promise<JSX.Element> {
  const prefs = await getDisplayPreferences().catch(() => ({ pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" }));
  const matchingPresets = libraryPresets.filter((preset) => preset.category === detail.asset.category);
  const visibleLibraryPresets = matchingPresets.length > 0 ? matchingPresets : libraryPresets;
  const visiblePresets = [
    ...visibleLibraryPresets.map((preset) => ({
      id: `library-${preset.key}`,
      sourceLabel: "Library",
      key: preset.key,
      category: preset.category,
      label: preset.label,
      description: preset.description,
      metricCount: preset.metricTemplates.length,
      scheduleCount: preset.scheduleTemplates.length
    })),
    ...customPresets.map((preset) => ({
      id: `custom-${preset.id}`,
      sourceLabel: "Custom",
      key: preset.id,
      category: preset.category,
      label: preset.label,
      description: preset.description,
      metricCount: preset.metricTemplates.length,
      scheduleCount: preset.scheduleTemplates.length
    }))
  ];
  const sortedConditionHistory = [...detail.asset.conditionHistory].sort((left, right) => (
    right.assessedAt.localeCompare(left.assessedAt)
  ));

  return (
    <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
      <AssetPurchaseDetailsCard
        assetId={assetId}
        householdId={detail.asset.householdId}
        purchaseDetails={detail.asset.purchaseDetails}
        currencyCode={prefs.currencyCode}
      />

      <AssetWarrantyDetailsCard
        assetId={assetId}
        householdId={detail.asset.householdId}
        warrantyDetails={detail.asset.warrantyDetails}
        dateFormat={prefs.dateFormat}
      />

      <AssetLocationDetailsCard
        assetId={assetId}
        householdId={detail.asset.householdId}
        locationDetails={detail.asset.locationDetails}
        spaceLocation={detail.asset.spaceLocation}
      />

      <AssetInsuranceDetailsCard
        assetId={assetId}
        householdId={detail.asset.householdId}
        insuranceDetails={detail.asset.insuranceDetails}
        dispositionDetails={detail.asset.dispositionDetails}
        currencyCode={prefs.currencyCode}
        dateFormat={prefs.dateFormat}
      />

      <section className="panel">
        <div className="panel__header">
          <h2>Condition History</h2>
        </div>
        <div className="panel__body--padded">
          <form action={recordConditionAssessmentAction} className="form-grid" style={{ marginBottom: "24px" }}>
            <input type="hidden" name="assetId" value={assetId} />
            <label className="field">
              <span>Score</span>
              <input type="number" name="score" min="1" max="10" step="1" required />
            </label>
            <label className="field field--full">
              <span>Notes</span>
              <textarea name="notes" rows={2} placeholder="Capture condition changes, findings, or observations" />
            </label>
            <button type="submit" className="button button--primary">Record Assessment</button>
          </form>

          {sortedConditionHistory.length === 0 ? (
            <p className="panel__empty">No condition assessments recorded yet.</p>
          ) : (
            <div className="schedule-stack">
              {sortedConditionHistory.map((entry) => (
                <article key={`${entry.assessedAt}-${entry.score}`} className="schedule-card">
                  <div className="schedule-card__summary">
                    <div>
                      <h3>Score {entry.score}/10</h3>
                      <p style={{ color: "var(--ink-muted)", fontSize: "0.88rem" }}>
                        {entry.notes ?? "No notes recorded."}
                      </p>
                    </div>
                    <span className="pill">{formatDateTime(entry.assessedAt, undefined, undefined, prefs.dateFormat)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Profile Fields</h2>
        </div>
        <div className="panel__body--padded">
          {detail.asset.fieldDefinitions.length === 0 ? (
            <p className="panel__empty">No custom profile fields defined.</p>
          ) : (
            <dl className="data-list">
              {detail.asset.fieldDefinitions.map((field) => {
                const rawValue = detail.asset.customFields[field.key];
                const renderedValue = rawValue === null || rawValue === undefined || rawValue === ""
                  ? "Not set"
                  : Array.isArray(rawValue)
                    ? rawValue.join(", ")
                    : String(rawValue);

                return (
                  <div key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>{renderedValue}</dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>
      </section>

      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <div className="panel__header">
          <h2>Preset Browser</h2>
          <span className="pill">{visiblePresets.length}</span>
        </div>
        <div className="preset-grid">
          {visiblePresets.map((preset) => (
            <article key={preset.id} className="preset-card">
              <div>
                <p className="eyebrow">{preset.sourceLabel} · {formatCategoryLabel(preset.category)}</p>
                <h3>{preset.label}</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>
                  {preset.description ?? "No description."}
                </p>
              </div>
              <div className="preset-card__meta">
                <span>{preset.metricCount} metrics</span>
                <span>{preset.scheduleCount} schedules</span>
              </div>
              {preset.sourceLabel === "Library" ? (
                <form action={applyPresetToAssetAction}>
                  <input type="hidden" name="assetId" value={assetId} />
                  <input type="hidden" name="presetKey" value={preset.key} />
                  <button type="submit" className="button button--ghost button--sm">Apply</button>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}