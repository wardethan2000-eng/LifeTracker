import type { JSX } from "react";
import { Suspense } from "react";
import { deleteServiceProviderAction } from "../../../../actions";
import { getMe, getServiceProvider } from "../../../../../lib/api";

type ProviderSettingsPageProps = {
  params: Promise<{ providerId: string }>;
};

export default async function ProviderSettingsPage({ params }: ProviderSettingsPageProps): Promise<JSX.Element> {
  const { providerId } = await params;
  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return <p>No household found.</p>;
  }

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section>}>
      <ProviderSettingsContent householdId={household.id} providerId={providerId} />
    </Suspense>
  );
}

async function ProviderSettingsContent({ householdId, providerId }: { householdId: string; providerId: string }): Promise<JSX.Element> {
  const provider = await getServiceProvider(householdId, providerId);

  return (
    <section className="panel panel--danger">
      <div className="panel__header">
        <h2>Danger Zone</h2>
      </div>
      <div className="panel__body--padded">
        <div>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Delete Provider</p>
          <p style={{ fontSize: "0.88rem", color: "var(--ink-muted)", marginBottom: 12 }}>
            Permanently remove {provider.name} and all associated data. This cannot be undone.
          </p>
          <form action={deleteServiceProviderAction} className="inline-actions">
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="providerId" value={provider.id} />
            <input type="hidden" name="redirectTo" value="/service-providers" />
            <button type="submit" className="button button--danger button--sm">Delete Provider</button>
          </form>
        </div>
      </div>
    </section>
  );
}
