import Link from "next/link";
import type { JSX } from "react";
import {
  createServiceProviderAction,
  deleteServiceProviderAction,
  updateServiceProviderAction
} from "../actions";
import { AppShell } from "../../components/app-shell";
import { ApiError, getHouseholdServiceProviders, getMe } from "../../lib/api";

type ServiceProvidersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ServiceProvidersPage({ searchParams }: ServiceProvidersPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};
  const householdId = typeof params.householdId === "string" ? params.householdId : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return (
        <AppShell activePath="/service-providers">
          <header className="page-header"><h1>Service Providers</h1></header>
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
          </div>
        </AppShell>
      );
    }

    const providers = await getHouseholdServiceProviders(household.id);

    return (
      <AppShell activePath="/service-providers">
        <header className="page-header">
          <div>
            <h1>Service Providers</h1>
            <p style={{ marginTop: 6 }}>Manage contractors, shops, installers, and vendors used across maintenance work.</p>
          </div>
        </header>

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

          <section className="panel">
            <div className="panel__header">
              <h2>Household Providers ({providers.length})</h2>
            </div>
            <div className="panel__body">
              {providers.length === 0 ? (
                <p className="panel__empty">No providers saved yet.</p>
              ) : (
                <div className="schedule-stack">
                  {providers.map((provider) => (
                    <div key={provider.id} className="schedule-card">
                      <form action={updateServiceProviderAction}>
                        <input type="hidden" name="householdId" value={household.id} />
                        <input type="hidden" name="providerId" value={provider.id} />
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
                        <input type="hidden" name="householdId" value={household.id} />
                        <input type="hidden" name="providerId" value={provider.id} />
                        <button type="submit" className="button button--danger">Delete Provider</button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <AppShell activePath="/service-providers">
          <header className="page-header"><h1>Service Providers</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load providers: {error.message}</p>
              </div>
            </div>
          </div>
        </AppShell>
      );
    }

    throw error;
  }
}