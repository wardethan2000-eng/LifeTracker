import type { JSX } from "react";
import { ThemeToggle } from "../../../components/theme-toggle";
import { HouseholdTimezoneEditor } from "../../../components/household-timezone-editor";
import { ApiError, getMe } from "../../../lib/api";

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
      </div>
    </>
  );
}