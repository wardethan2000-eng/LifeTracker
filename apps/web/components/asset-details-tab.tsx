import type { AssetDetailResponse } from "@aegis/types";
import type { JSX } from "react";
import { recordConditionAssessmentAction } from "../app/actions";
import { formatDateTime } from "../lib/formatters";
import { getDisplayPreferences } from "../lib/api";
import {
  AssetInsuranceDetailsCard,
  AssetLocationDetailsCard,
  AssetProfileFieldsCard,
  AssetPurchaseDetailsCard,
  AssetWarrantyDetailsCard,
} from "./asset-details-cards";

type AssetDetailsTabProps = {
  detail: AssetDetailResponse;
  assetId: string;
};

export async function AssetDetailsTab({ detail, assetId }: AssetDetailsTabProps): Promise<JSX.Element> {
  const prefs = await getDisplayPreferences().catch(() => ({ pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" }));
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

      <AssetProfileFieldsCard
        assetId={assetId}
        householdId={detail.asset.householdId}
        fieldDefinitions={detail.asset.fieldDefinitions}
        customFields={detail.asset.customFields}
      />
    </div>
  );
}
