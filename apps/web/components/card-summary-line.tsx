import type { Asset } from "@lifekeeper/types";

const shortDateFmt = (timezone?: string) => new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric", year: "numeric", ...(timezone ? { timeZone: timezone } : {}) });
const monthYearFmt = (timezone?: string) => new Intl.DateTimeFormat("en-US", { month: "numeric", year: "numeric", ...(timezone ? { timeZone: timezone } : {}) });

/** Format a purchase details summary line (collapsed view). */
export function purchaseSummary(asset: Asset, timezone?: string): string {
  const { purchaseDetails, purchaseDate } = asset;
  const parts: string[] = [];

  const date = purchaseDate
    ? shortDateFmt(timezone).format(new Date(purchaseDate))
    : null;
  if (date) parts.push(`Purchased ${date}`);

  if (purchaseDetails?.price != null) {
    parts.push(`$${purchaseDetails.price.toLocaleString()}`);
  }
  if (purchaseDetails?.vendor) parts.push(purchaseDetails.vendor);

  return parts.length > 0 ? parts.join(" · ") : "Not configured";
}

/** Format a warranty summary line. */
export function warrantySummary(asset: Asset, timezone?: string): string {
  const w = asset.warrantyDetails;
  if (!w) return "Not configured";
  const parts: string[] = [];

  if (w.endDate) {
    parts.push(`Expires ${monthYearFmt(timezone).format(new Date(w.endDate))}`);
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
export function conditionSummary(asset: Asset, timezone?: string): string {
  if (asset.conditionScore == null && asset.conditionHistory.length === 0) {
    return "Not configured";
  }
  const parts: string[] = [];

  if (asset.conditionScore != null) parts.push(`Score: ${asset.conditionScore}/10`);

  const latest = [...asset.conditionHistory].sort((a, b) => b.assessedAt.localeCompare(a.assessedAt))[0];
  if (latest) {
    parts.push(`Last assessed ${monthYearFmt(timezone).format(new Date(latest.assessedAt))}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "Not configured";
}

/** Format a disposition summary line. */
export function dispositionSummary(asset: Asset, timezone?: string): string {
  const d = asset.dispositionDetails;
  if (!d || !d.method) return "Not configured";
  const parts = [d.method.charAt(0).toUpperCase() + d.method.slice(1)];

  if (d.date) {
    parts.push(shortDateFmt(timezone).format(new Date(d.date)));
  }

  return parts.join(" · ");
}
