import { Suspense, type JSX } from "react";
import { ThemeToggle } from "../../../components/theme-toggle";
import { HouseholdTimezoneEditor } from "../../../components/household-timezone-editor";
import { ApiError, getDisplayPreferences, getMe, getNotificationPreferences } from "../../../lib/api";
import { NotificationPreferencesForm } from "../../../components/notification-preferences-form";
import { DisplayPreferencesForm } from "../../../components/display-preferences-form";
import { DataManagementSection } from "../../../components/data-management-section";

async function SettingsContent({ householdId, currentTimezone }: { householdId: string | null; currentTimezone: string }): Promise<JSX.Element> {
  const [preferences, displayPreferences] = await Promise.all([
    getNotificationPreferences(),
    getDisplayPreferences().catch(() => ({ pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" })),
  ]);

  return (
    <div className="page-body">
      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Appearance</h2>
            <p className="data-table__secondary">Choose between light and dark mode.</p>
          </div>
        </div>
        <div className="panel__body--padded">
          <ThemeToggle />
        </div>
      </section>

      {householdId && (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Timezone</h2>
              <p className="data-table__secondary">Set the timezone used to display dates and times across your household.</p>
            </div>
          </div>
          <div className="panel__body--padded">
            <HouseholdTimezoneEditor
              householdId={householdId}
              currentTimezone={currentTimezone}
            />
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Display</h2>
            <p className="data-table__secondary">Date format, currency, and list defaults applied across the app.</p>
          </div>
        </div>
        <div className="panel__body--padded">
          <DisplayPreferencesForm initialPreferences={displayPreferences} />
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>Notifications</h2>
            <p className="data-table__secondary">Control how and when you receive notifications.</p>
          </div>
        </div>
        <div className="panel__body--padded">
          <NotificationPreferencesForm initialPreferences={preferences} />
        </div>
      </section>

      {householdId && (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Data management</h2>
              <p className="data-table__secondary">Export your data or permanently delete your account.</p>
            </div>
          </div>
          <div className="panel__body--padded">
            <DataManagementSection householdId={householdId} />
          </div>
        </section>
      )}
    </div>
  );
}

export default async function UserSettingsPage(): Promise<JSX.Element> {
  let householdId: string | null = null;
  let currentTimezone = "America/New_York";

  try {
    const me = await getMe();
    const household = me.households[0];
    if (household) {
      householdId = household.id;
      currentTimezone = household.timezone;
    }
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>User Settings</h1>
          <p>Personal interface preferences for this browser.</p>
        </div>
      </header>

      <Suspense fallback={<div className="page-body"><section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section></div>}>
        <SettingsContent householdId={householdId} currentTimezone={currentTimezone} />
      </Suspense>
    </>
  );
}