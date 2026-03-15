import type { Asset } from "@lifekeeper/types";

/** Format a purchase details summary line (collapsed view). */
export function purchaseSummary(asset: Asset): string {
  const { purchaseDetails, purchaseDate } = asset;
  const parts: string[] = [];

  const date = purchaseDate
    ? new Date(purchaseDate).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })
    : null;
  if (date) parts.push(`Purchased ${date}`);

  if (purchaseDetails?.price != null) {
    parts.push(`$${purchaseDetails.price.toLocaleString()}`);
  }
  if (purchaseDetails?.vendor) parts.push(purchaseDetails.vendor);

  return parts.length > 0 ? parts.join(" · ") : "Not configured";
}

/** Format a warranty summary line. */
export function warrantySummary(asset: Asset): string {
  const w = asset.warrantyDetails;
  if (!w) return "Not configured";
  const parts: string[] = [];

  if (w.endDate) {
    const d = new Date(w.endDate);
    parts.push(`Expires ${d.toLocaleDateString("en-US", { month: "numeric", year: "numeric" })}`);
  }
  if (w.coverageType) parts.push(w.coverageType);
  if (w.provider) parts.push(w.provider);

  return parts.length > 0 ? parts.join(" · ") : "Not configured";
}

/** Format a location summary line. */
export function locationSummary(asset: Asset): string {
  const l = asset.locationDetails;
  if (!l) return "Not configured";
  const parts: string[] = [];

  if (l.room) parts.push(l.room);
  else if (l.building) parts.push(l.building);
  if (l.propertyName) parts.push(l.propertyName);

  return parts.length > 0 ? parts.join(" · ") : "Not configured";
}

/** Format an insurance summary line. */
export function insuranceSummary(asset: Asset): string {
  const i = asset.insuranceDetails;
  if (!i) return "Not configured";
  const parts: string[] = [];

  if (i.provider) parts.push(i.provider);
  if (i.policyNumber) parts.push(`Policy #${i.policyNumber}`);

  return parts.length > 0 ? parts.join(" · ") : "Not configured";
}

/** Format a condition summary line. */
export function conditionSummary(asset: Asset): string {
  if (asset.conditionScore == null && asset.conditionHistory.length === 0) {
    return "Not configured";
  }
  const parts: string[] = [];

  if (asset.conditionScore != null) parts.push(`Score: ${asset.conditionScore}/10`);

  const latest = [...asset.conditionHistory].sort((a, b) => b.assessedAt.localeCompare(a.assessedAt))[0];
  if (latest) {
    const d = new Date(latest.assessedAt);
    parts.push(`Last assessed ${d.toLocaleDateString("en-US", { month: "numeric", year: "numeric" })}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "Not configured";
}

/** Format a disposition summary line. */
export function dispositionSummary(asset: Asset): string {
  const d = asset.dispositionDetails;
  if (!d || !d.method) return "Not configured";
  const parts = [d.method.charAt(0).toUpperCase() + d.method.slice(1)];

  if (d.date) {
    const dt = new Date(d.date);
    parts.push(dt.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }));
  }

  return parts.join(" · ");
}
