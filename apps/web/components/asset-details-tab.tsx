import type { AssetDetailResponse, CustomPresetProfile, LibraryPreset } from "@lifekeeper/types";
import type { JSX } from "react";
import {
  applyPresetToAssetAction,
  recordConditionAssessmentAction
} from "../app/actions";
import {
  formatCategoryLabel,
  formatDate,
  formatDateTime
} from "../lib/formatters";
import { getDisplayPreferences } from "../lib/api";
import {
  renderMetaRow,
  renderMoneyMetaRow
} from "../app/(dashboard)/assets/[assetId]/shared";

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
      <section className="panel">
        <div className="panel__header">
          <h2>Purchase Details</h2>
        </div>
        <div className="panel__body--padded">
          <dl className="data-list">
            {renderMoneyMetaRow("Price", detail.asset.purchaseDetails?.price ?? null, prefs.currencyCode)}
            {renderMetaRow("Vendor", detail.asset.purchaseDetails?.vendor)}
            {renderMetaRow("Condition", detail.asset.purchaseDetails?.condition ?? null)}
            {renderMetaRow("Financing", detail.asset.purchaseDetails?.financing)}
            {renderMetaRow("Receipt Reference", detail.asset.purchaseDetails?.receiptRef)}
          </dl>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Warranty Details</h2>
        </div>
        <div className="panel__body--padded">
          <dl className="data-list">
            {renderMetaRow("Provider", detail.asset.warrantyDetails?.provider)}
            {renderMetaRow("Policy Number", detail.asset.warrantyDetails?.policyNumber)}
            {renderMetaRow("Coverage Type", detail.asset.warrantyDetails?.coverageType)}
            {renderMetaRow("Start", formatDate(detail.asset.warrantyDetails?.startDate, "Not set", undefined, prefs.dateFormat))}
            {renderMetaRow("End", formatDate(detail.asset.warrantyDetails?.endDate, "Not set", undefined, prefs.dateFormat))}
            {renderMetaRow("Notes", detail.asset.warrantyDetails?.notes)}
          </dl>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Location Details</h2>
        </div>
        <div className="panel__body--padded">
          <dl className="data-list">
            {renderMetaRow("Property", detail.asset.locationDetails?.propertyName)}
            {renderMetaRow("Building", detail.asset.locationDetails?.building)}
            {renderMetaRow("Room", detail.asset.locationDetails?.room)}
            {renderMetaRow(
              "Coordinates",
              detail.asset.locationDetails?.latitude !== undefined && detail.asset.locationDetails?.longitude !== undefined
                ? `${detail.asset.locationDetails.latitude}, ${detail.asset.locationDetails.longitude}`
                : null
            )}
            {renderMetaRow("Notes", detail.asset.locationDetails?.notes)}
          </dl>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>Insurance &amp; Disposition</h2>
        </div>
        <div className="panel__body--padded">
          <dl className="data-list">
            {renderMetaRow("Insurance Provider", detail.asset.insuranceDetails?.provider)}
            {renderMetaRow("Policy Number", detail.asset.insuranceDetails?.policyNumber)}
            {renderMoneyMetaRow("Coverage Amount", detail.asset.insuranceDetails?.coverageAmount ?? null, prefs.currencyCode)}
            {renderMoneyMetaRow("Deductible", detail.asset.insuranceDetails?.deductible ?? null, prefs.currencyCode)}
            {renderMetaRow("Renewal Date", formatDate(detail.asset.insuranceDetails?.renewalDate, "Not set", undefined, prefs.dateFormat))}
            {renderMetaRow("Disposition Method", detail.asset.dispositionDetails?.method ?? null)}
            {renderMetaRow("Disposition Date", formatDate(detail.asset.dispositionDetails?.date, "Not set", undefined, prefs.dateFormat))}
            {renderMoneyMetaRow("Sale Price", detail.asset.dispositionDetails?.salePrice ?? null, prefs.currencyCode)}
            {renderMetaRow("Buyer Info", detail.asset.dispositionDetails?.buyerInfo)}
          </dl>
        </div>
      </section>

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