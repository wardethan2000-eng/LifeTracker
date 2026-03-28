import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import { CopyTextButton } from "../../../../components/copy-text-button";
import {
  updateServiceProviderAction
} from "../../../actions";
import {
  ApiError,
  getDisplayPreferences,
  getMe,
  getServiceProvider,
  getServiceProviderSpend
} from "../../../../lib/api";
import { formatCurrency, formatDateTime } from "../../../../lib/formatters";

type ServiceProviderDetailPageProps = {
  params: Promise<{ providerId: string }>;
};

const formatContactValue = (value: string | null): string => value ?? "Not recorded";

export default async function ServiceProviderOverviewPage({ params }: ServiceProviderDetailPageProps): Promise<JSX.Element> {
  const { providerId } = await params;
  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link>.</p>;
  }

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading provider details…</div></div>}>
      <ProviderDetailContent householdId={household.id} providerId={providerId} />
    </Suspense>
  );
}

async function ProviderDetailContent({ householdId, providerId }: { householdId: string; providerId: string }): Promise<JSX.Element> {
  const prefs = await getDisplayPreferences().catch(() => ({ pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" }));

  try {
    const [provider, spend] = await Promise.all([
      getServiceProvider(householdId, providerId),
      getServiceProviderSpend(householdId)
    ]);

    const spendSummary = spend.providers.find((entry) => entry.providerId === provider.id) ?? null;
    const totalActivityCount = (spendSummary?.maintenanceLogCount ?? 0) + (spendSummary?.projectExpenseCount ?? 0);

    return (
      <>
        <section className="stats-row">
          <div className="stat-card stat-card--accent">
            <span className="stat-card__label">Total Spend</span>
            <strong className="stat-card__value">{formatCurrency(spendSummary?.totalCombinedCost ?? 0, "$0.00", prefs.currencyCode)}</strong>
            <span className="stat-card__sub">Maintenance and project spend combined</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Maintenance Logs</span>
            <strong className="stat-card__value">{spendSummary?.maintenanceLogCount ?? 0}</strong>
            <span className="stat-card__sub">Logged maintenance jobs using this provider</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Project Expenses</span>
            <strong className="stat-card__value">{spendSummary?.projectExpenseCount ?? 0}</strong>
            <span className="stat-card__sub">Project expense entries linked here</span>
          </div>
          <div className="stat-card stat-card--warning">
            <span className="stat-card__label">Last Used</span>
            <strong className="stat-card__value">{spendSummary?.lastUsed ? formatDateTime(spendSummary.lastUsed, undefined, undefined, prefs.dateFormat) : "—"}</strong>
            <span className="stat-card__sub">{totalActivityCount} tracked activity records</span>
          </div>
        </section>

        <div style={{ display: "grid", gap: 24, gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)" }}>
          <section className="panel">
            <div className="panel__header">
              <h2>Edit Provider</h2>
            </div>
            <div className="panel__body--padded">
              <form action={updateServiceProviderAction} className="form-grid">
                <input type="hidden" name="householdId" value={householdId} />
                <input type="hidden" name="providerId" value={provider.id} />
                <label className="field"><span>Name</span><input type="text" name="name" defaultValue={provider.name} required /></label>
                <label className="field"><span>Specialty</span><input type="text" name="specialty" defaultValue={provider.specialty ?? ""} /></label>
                <label className="field"><span>Phone</span><input type="tel" name="phone" defaultValue={provider.phone ?? ""} /></label>
                <label className="field"><span>Email</span><input type="email" name="email" defaultValue={provider.email ?? ""} /></label>
                <label className="field"><span>Website</span><input type="url" name="website" defaultValue={provider.website ?? ""} /></label>
                <label className="field"><span>Rating</span><input type="number" name="rating" min="1" max="5" step="1" defaultValue={provider.rating ?? ""} /></label>
                <label className="field field--full"><span>Address</span><input type="text" name="address" defaultValue={provider.address ?? ""} /></label>
                <label className="field field--full"><span>Notes</span><textarea name="notes" rows={5} defaultValue={provider.notes ?? ""} /></label>
                <div className="inline-actions inline-actions--end field field--full">
                  <button type="submit" className="button button--primary">Save Provider</button>
                </div>
              </form>
            </div>
          </section>

          <aside style={{ display: "grid", gap: 24, alignContent: "start" }}>
            <section className="panel">
              <div className="panel__header">
                <h2>Contact Details</h2>
              </div>
              <div className="panel__body--padded">
                <dl className="data-list">
                  <div>
                    <dt>Phone</dt>
                    <dd style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span>{formatContactValue(provider.phone)}</span>
                      {provider.phone ? <CopyTextButton value={provider.phone} label="Copy" copiedLabel="Copied" /> : null}
                    </dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span>{formatContactValue(provider.email)}</span>
                      {provider.email ? <CopyTextButton value={provider.email} label="Copy" copiedLabel="Copied" /> : null}
                    </dd>
                  </div>
                  <div><dt>Website</dt><dd>{provider.website ? <a href={provider.website} className="text-link" target="_blank" rel="noreferrer">{provider.website}</a> : "Not recorded"}</dd></div>
                  <div><dt>Address</dt><dd>{formatContactValue(provider.address)}</dd></div>
                  <div><dt>Created</dt><dd>{formatDateTime(provider.createdAt, "—", undefined, prefs.dateFormat)}</dd></div>
                  <div><dt>Last Updated</dt><dd>{formatDateTime(provider.updatedAt, "—", undefined, prefs.dateFormat)}</dd></div>
                </dl>
              </div>
            </section>

            <section className="panel">
              <div className="panel__header">
                <h2>Usage Summary</h2>
              </div>
              <div className="panel__body--padded">
                {spendSummary ? (
                  <dl className="data-list">
                    <div><dt>First Used</dt><dd>{spendSummary.firstUsed ? formatDateTime(spendSummary.firstUsed, undefined, undefined, prefs.dateFormat) : "—"}</dd></div>
                    <div><dt>Last Used</dt><dd>{spendSummary.lastUsed ? formatDateTime(spendSummary.lastUsed, undefined, undefined, prefs.dateFormat) : "—"}</dd></div>
                    <div><dt>Maintenance Spend</dt><dd>{formatCurrency(spendSummary.totalMaintenanceCost, "$0.00", prefs.currencyCode)}</dd></div>
                    <div><dt>Project Spend</dt><dd>{formatCurrency(spendSummary.totalProjectCost, "$0.00", prefs.currencyCode)}</dd></div>
                  </dl>
                ) : (
                  <p className="panel__empty">No maintenance logs or project expenses have been linked to this provider yet.</p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load provider details: {error.message}</p>
          </div>
        </div>
      );
    }

    throw error;
  }
}