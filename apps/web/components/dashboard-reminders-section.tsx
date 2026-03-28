import { getEntries, getLayoutPreference } from "../lib/api";
import { DashboardReminders } from "./dashboard-reminders";

/**
 * Async server component that fetches reminder entries independently of the
 * main dashboard data. Wrapped in <Suspense> in page.tsx so it streams in
 * without blocking the attention queue or the primary dashboard grid.
 */
export async function DashboardRemindersSection({ householdId }: { householdId: string }) {
  const defaultReminderCutoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const [reminderWindowPref, reminderEntries] = await Promise.all([
    getLayoutPreference("reminders_dashboard", "window_days").catch(() => null),
    getEntries(householdId, {
      hasReminder: true,
      reminderBefore: defaultReminderCutoff,
      limit: 20,
    }).catch(() => ({ items: [], nextCursor: null })),
  ]);

  const reminderWindowDays = (reminderWindowPref as Array<{ value: number }> | null)?.[0]?.value ?? 7;

  return (
    <DashboardReminders
      householdId={householdId}
      entries={reminderEntries.items}
      windowDays={reminderWindowDays}
    />
  );
}
