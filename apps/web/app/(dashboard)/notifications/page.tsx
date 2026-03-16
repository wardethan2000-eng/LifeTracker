import Link from "next/link";
import type { JSX } from "react";
import { markNotificationReadAction, enqueueNotificationScanAction } from "../../actions";
import { ApiError, getHouseholdNotifications, getMe } from "../../../lib/api";
import { formatDateTime, formatNotificationTone } from "../../../lib/formatters";

export default async function NotificationsPage(): Promise<JSX.Element> {
  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return (
        <>
          <header className="page-header"><h1>Notifications</h1></header>
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
          </div>
        </>
      );
    }

    const notificationList = await getHouseholdNotifications(household.id, { limit: 100 });

    return (
      <>
        <header className="page-header">
          <h1>Notifications</h1>
          <div className="page-header__actions">
            <form action={enqueueNotificationScanAction}>
              <input type="hidden" name="householdId" value={household.id} />
              <button type="submit" className="button button--ghost">Run Notification Scan</button>
            </form>
          </div>
        </header>

        <div className="page-body">
          <section className="panel">
            <div className="panel__header">
              <h2>All Notifications ({notificationList.notifications.length})</h2>
            </div>
            <div className="panel__body">
              {notificationList.notifications.length === 0 ? (
                <p className="panel__empty">No notifications yet. Notifications are generated when maintenance schedules become due.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Title</th>
                      <th>Message</th>
                      <th>Channel</th>
                      <th>Scheduled</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {notificationList.notifications.map((notification) => {
                      const tone = formatNotificationTone(notification);

                      return (
                        <tr key={notification.id}>
                          <td>
                            <span className={`status-chip status-chip--${tone === "pending" ? "pending" : "read"}`}>
                              {tone === "pending" ? "Unread" : "Read"}
                            </span>
                          </td>
                          <td>
                            <div className="data-table__primary">{notification.title}</div>
                          </td>
                          <td>
                            <div className="data-table__secondary" style={{ maxWidth: 320 }}>{notification.body}</div>
                          </td>
                          <td><span className="pill">{notification.channel}</span></td>
                          <td>{formatDateTime(notification.scheduledFor)}</td>
                          <td>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              {notification.assetId && (
                                <Link href={`/assets/${notification.assetId}`} className="data-table__link">View Asset</Link>
                              )}
                              {!notification.readAt && notification.status !== "read" && (
                                <form action={markNotificationReadAction}>
                                  <input type="hidden" name="notificationId" value={notification.id} />
                                  <button type="submit" className="button button--ghost button--sm">Mark Read</button>
                                </form>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Notifications</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load: {error.message}</p>
              </div>
            </div>
          </div>
        </>
      );
    }
    throw error;
  }
}
