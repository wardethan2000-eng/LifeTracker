import Link from "next/link";
import { Suspense } from "react";
import type { JSX } from "react";
import { createHouseholdAction } from "../actions";
import { LaunchPad } from "../../components/launch-pad";
import { RealtimeRefreshBoundary } from "../../components/realtime-refresh-boundary";
import { ApiError, getApiBaseUrl, getDevUserId, getMe } from "../../lib/api";
import { DashboardRemindersSection } from "../../components/dashboard-reminders-section";
import { DashboardAttentionSection } from "../../components/dashboard-attention-section";
import { DashboardOnboardingSection } from "../../components/dashboard-onboarding-section";
import { HomeDashboardSection } from "../../components/home-dashboard-section";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getParam = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string" && value.length > 0) return value;
  return Array.isArray(value) ? value[0] : undefined;
};

const DashboardError = ({ message }: { message: string }): JSX.Element => (
  <main className="error-shell">
    <section className="error-card">
      <p className="eyebrow">Connection error</p>
      <h1>Dashboard could not load</h1>
      <p>{message}</p>
      <dl className="meta-list">
        <div>
          <dt>API base URL</dt>
          <dd>{getApiBaseUrl()}</dd>
        </div>
        <div>
          <dt>Dev user header</dt>
          <dd>{getDevUserId()}</dd>
        </div>
      </dl>
      <p className="note">Start the API, seed the database, and keep dev auth bypass enabled for the seeded demo user.</p>
    </section>
  </main>
);

const EmptyHouseholds = (): JSX.Element => (
  <main className="error-shell">
    <section className="error-card">
      <p className="eyebrow">First-run setup</p>
      <h1>Create your first household</h1>
      <p>The dashboard is household-scoped. Create a household to start tracking assets.</p>
      <form action={createHouseholdAction} className="form-grid form-grid--single" style={{ gap: 12 }}>
        <label className="field">
          <span>Household name</span>
          <input type="text" name="name" placeholder="Main household" required />
        </label>
        <button type="submit" className="button button--primary">Create household</button>
      </form>
    </section>
  </main>
);

export default async function HomePage({ searchParams }: HomePageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};

  try {
    // getMe() is React-cached (5 min). Resolves fast so the header and shell
    // render immediately without waiting for any dashboard data.
    const me = await getMe();
    const fallbackHousehold = me.households[0];

    if (!fallbackHousehold) return <EmptyHouseholds />;

    const requestedHouseholdId = getParam(params.householdId);
    const selectedHousehold = me.households.find((h) => h.id === requestedHouseholdId) ?? fallbackHousehold;

    return (
      <>
        <RealtimeRefreshBoundary householdId={selectedHousehold.id} eventTypes={["asset.updated", "inventory.changed", "maintenance.completed", "hobby.session-progress"]} />
        <header className="page-header">
          <h1>Dashboard</h1>
          <div className="page-header__actions">
            {me.households.length > 1 && (
              <div className="household-switcher">
                {me.households.map((h) => (
                  <Link
                    key={h.id}
                    href={`/?householdId=${h.id}`}
                    className={`household-chip${h.id === selectedHousehold.id ? " household-chip--active" : ""}`}
                  >
                    {h.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </header>

        <div className="page-body">
          {/* LaunchPad renders instantly — no data dependency */}
          <LaunchPad />

          {/* Reminders stream in independently (no-store entry fetch, runs concurrently) */}
          <Suspense fallback={null}>
            <DashboardRemindersSection householdId={selectedHousehold.id} />
          </Suspense>

          {/* Attention queue streams in as soon as getDashboardData resolves */}
          <Suspense fallback={<div className="attention-queue attention-queue--loading" aria-busy="true" />}>
            <DashboardAttentionSection householdId={selectedHousehold.id} />
          </Suspense>

          {/* Onboarding short-circuits on first await when already dismissed */}
          <Suspense fallback={null}>
            <DashboardOnboardingSection householdId={selectedHousehold.id} />
          </Suspense>

          {/* Main dashboard grid — streams in with all card data. getDashboardData
              is React-cached so it deduplicates with the AttentionSection call. */}
          <Suspense fallback={<div className="dashboard-grid-loading" aria-busy="true" />}>
            <HomeDashboardSection householdId={selectedHousehold.id} />
          </Suspense>
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) return <DashboardError message={error.message} />;
    throw error;
  }
}