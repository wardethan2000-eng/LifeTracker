import Link from "next/link";
import type { Notification } from "@aegis/types";
import type { JSX } from "react";
import { markNotificationReadAction } from "../app/actions";
import { formatDateTime, formatNotificationTone } from "../lib/formatters";

type DashboardNotificationsAsideProps = {
  notifications: Notification[];
};

const getNotificationTargetHref = (notification: Notification): string | null => {
  if (notification.assetId) {
    return `/assets/${notification.assetId}`;
  }

  const entityType = notification.payload.entityType;
  const entityId = notification.payload.entityId;

  if (entityType === "project" && typeof entityId === "string") {
    return `/projects/${entityId}`;
  }

  return null;
};

export async function DashboardNotificationsAside({ notifications }: DashboardNotificationsAsideProps): Promise<JSX.Element> {
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Recent Notifications</h2>
        {notifications.length > 5 && (
          <Link href="/notifications" className="text-link" style={{ fontSize: "0.85rem" }}>View all</Link>
        )}
      </div>
      <div className="panel__body">
        {notifications.length === 0 ? (
          <p className="panel__empty">No notifications yet.</p>
        ) : (
          <div className="notification-feed">
            {notifications.slice(0, 5).map((notification) => {
              const tone = formatNotificationTone(notification);
              const targetHref = getNotificationTargetHref(notification);

              return (
                <div key={notification.id} className={`notification-item${tone === "pending" ? " notification-item--unread" : ""}`}>
                  <div className="notification-item__body">
                    <h4>{notification.title}</h4>
                    <p>{notification.body}</p>
                  </div>
                  <div className="notification-item__actions">
                    <span className="notification-item__meta">{formatDateTime(notification.scheduledFor)}</span>
                    {targetHref && (
                      <Link href={targetHref} className="text-link" style={{ fontSize: "0.8rem" }}>View</Link>
                    )}
                    {!notification.readAt && notification.status !== "read" && (
                      <form action={markNotificationReadAction}>
                        <input type="hidden" name="notificationId" value={notification.id} />
                        <button type="submit" className="button button--ghost button--sm">Read</button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}