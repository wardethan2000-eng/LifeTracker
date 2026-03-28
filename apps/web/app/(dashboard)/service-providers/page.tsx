import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import {
  createServiceProviderAction,
  deleteServiceProviderAction,
  updateServiceProviderAction
} from "../../actions";
import { ApiError, getHouseholdServiceProviders, getMe } from "../../../lib/api";
import { PageHeader } from "../../../components/page-header";
import { EmptyState } from "../../../components/empty-state";

type ServiceProvidersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const buildProviderHref = (householdId: string, providerId: string): string => `/service-providers/${providerId}?householdId=${householdId}`;

export default async function ServiceProvidersPage({ searchParams }: ServiceProvidersPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};
  const householdId = typeof params.householdId === "string" ? params.householdId : undefined;
  const highlightId = typeof params.highlight === "string" ? params.highlight : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return (
        <>
          <PageHeader title="Service Providers" />
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
          </div>
        </>
      );
    }

    const providers = await getHouseholdServiceProviders(household.id);

    return (
      <>
        <PageHeader
          title="Service Providers"
          subtitle="Manage contractors, shops, installers, and vendors used across maintenance work."
        />

        <div className="page-body">
          <section className="panel">
            <div className="panel__header">
              <h2>Add Provider</h2>
            </div>
            <div className="panel__body--padded">
              <form action={createServiceProviderAction}>
                <input type="hidden" name="householdId" value={household.id} />
                <div className="form-grid">
                  <label className="field"><span>Name</span><input type="text" name="name" placeholder="Acme HVAC" required /></label>
                  <label className="field"><span>Specialty</span><input type="text" name="specialty" placeholder="HVAC, electrical, detailing" /></label>
                  <label className="field"><span>Phone</span><input type="tel" name="phone" placeholder="(555) 555-5555" /></label>
                  <label className="field"><span>Email</span><input type="email" name="email" placeholder="hello@example.com" /></label>
                  <label className="field"><span>Website</span><input type="url" name="website" placeholder="https://example.com" /></label>
                  <label className="field"><span>Rating</span><input type="number" name="rating" min="1" max="5" step="1" placeholder="5" /></label>
                  <label className="field field--full"><span>Address</span><input type="text" name="address" placeholder="123 Main St, Springfield" /></label>
                  <label className="field field--full"><span>Notes</span><textarea name="notes" rows={3} placeholder="Warranty contact, preferred hours, negotiated rates" /></label>
                </div>
                <div className="inline-actions" style={{ marginTop: 20 }}>
                  <button type="submit" className="button">Create Provider</button>
                </div>
              </form>
            </div>
          </section>

          <Suspense fallback={<div className="panel"><div className="panel__empty">Loading providers…</div></div>}>
            <ProvidersListContent householdId={household.id} highlightId={highlightId} />
          </Suspense>
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <PageHeader title="Service Providers" />
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load providers: {error.message}</p>
              </div>
            </div>
          </div>
        </>
      );
    }

    throw error;
  }
}

async function ProvidersListContent({ householdId, highlightId }: { householdId: string; highlightId: string | undefined }): Promise<JSX.Element> {
  const providers = await getHouseholdServiceProviders(householdId);

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Household Providers ({providers.length})</h2>
      </div>
      <div className="panel__body">
        {providers.length === 0 ? (
          <EmptyState
            icon="wrench"
            title="No providers yet"
            message="Add a contractor, shop, or vendor to start tracking your service providers."
          />
        ) : (
          <div className="schedule-stack">
            {providers.map((provider) => (
              <div key={provider.id} className={`schedule-card${provider.id === highlightId ? " schedule-card--highlight" : ""}`}>
                <form action={updateServiceProviderAction}>
                  <input type="hidden" name="householdId" value={householdId} />
                  <input type="hidden" name="providerId" value={provider.id} />
                  <div className="inline-actions inline-actions--end" style={{ marginBottom: 16 }}>
                    <Link href={`/service-providers/${provider.id}?householdId=${householdId}`} className="button button--ghost button--sm">Open Details</Link>
                  </div>
                  <div className="form-grid">
                    <label className="field"><span>Name</span><input type="text" name="name" defaultValue={provider.name} required /></label>
                    <label className="field"><span>Specialty</span><input type="text" name="specialty" defaultValue={provider.specialty ?? ""} /></label>
                    <label className="field"><span>Phone</span><input type="tel" name="phone" defaultValue={provider.phone ?? ""} /></label>
                    <label className="field"><span>Email</span><input type="email" name="email" defaultValue={provider.email ?? ""} /></label>
                    <label className="field"><span>Website</span><input type="url" name="website" defaultValue={provider.website ?? ""} /></label>
                    <label className="field"><span>Rating</span><input type="number" name="rating" min="1" max="5" step="1" defaultValue={provider.rating ?? ""} /></label>
                    <label className="field field--full"><span>Address</span><input type="text" name="address" defaultValue={provider.address ?? ""} /></label>
                    <label className="field field--full"><span>Notes</span><textarea name="notes" rows={2} defaultValue={provider.notes ?? ""} /></label>
                  </div>
                  <div className="inline-actions" style={{ marginTop: 16 }}>
                    <button type="submit" className="button button--ghost">Save Provider</button>
                  </div>
                </form>
                <form action={deleteServiceProviderAction} className="inline-actions inline-actions--end">
                  <input type="hidden" name="householdId" value={householdId} />
                  <input type="hidden" name="providerId" value={provider.id} />
                  <button type="submit" className="button button--danger">Delete Provider</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}