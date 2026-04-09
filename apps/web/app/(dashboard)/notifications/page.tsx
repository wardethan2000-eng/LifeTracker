import Link from "next/link";
import type { Notification } from "@aegis/types";
import { Suspense, type JSX } from "react";
import { CursorPaginationControls } from "../../../components/pagination-controls";
import { getTranslations } from "next-intl/server";
import {
  markNotificationReadAction,
  markNotificationUnreadAction,
  markNotificationsReadAction,
  markNotificationsUnreadAction
} from "../../actions";
import { ApiError, getDisplayPreferences, getHouseholdNotifications, getMe } from "../../../lib/api";
import { formatDateTime, formatNotificationTone } from "../../../lib/formatters";

type NotificationsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const channelOptions = ["all", "push", "email", "digest"] as const;
const statusOptions = ["all", "unread", "read"] as const;
const typeOptions = ["all", "overdue", "due", "due_soon", "inventory_low_stock", "announcement", "digest"] as const;
const limitOptions = [25, 50, 100] as const;

const getNotificationTypeLabel = (value: Notification["type"]): string => value
  .replace(/_/g, " ")
  .replace(/\b\w/g, (character) => character.toUpperCase());

const getNotificationBucket = (notification: Notification): "overdue" | "dueSoon" | "informational" => {
  if (notification.type === "overdue") {
    return "overdue";
  }

  if (
    notification.type === "due"
    || notification.type === "due_soon"
    || notification.type === "inventory_low_stock"
    || (notification.type === "announcement" && notification.payload.notificationContext === "project_budget_overrun")
  ) {
    return "dueSoon";
  }

  return "informational";
};

const buildNotificationsHref = (params: {
  status: string;
  channel: string;
  type: string;
  limit: number;
  cursor?: string;
  history?: string[];
}): string => {
  const query = new URLSearchParams();
  query.set("status", params.status);
  query.set("channel", params.channel);
  query.set("type", params.type);
  query.set("limit", String(params.limit));

  if (params.cursor) {
    query.set("cursor", params.cursor);
  }

  if (params.history && params.history.length > 0) {
    query.set("history", params.history.join(","));
  }

  return `/notifications?${query.toString()}`;
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

function NotificationTable({ notifications }: { notifications: Notification[] }): JSX.Element {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Status</th>
          <th>Type</th>
          <th>Title</th>
          <th>Message</th>
          <th>Channel</th>
          <th>Scheduled</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {notifications.map((notification) => {
          const tone = formatNotificationTone(notification);
          const targetHref = getNotificationTargetHref(notification);

          return (
            <tr key={notification.id}>
              <td>
                <span className={`pill ${tone === "pending" ? "pill--info" : "pill--muted"}`}>
                  {tone === "pending" ? "Unread" : "Read"}
                </span>
              </td>
              <td><span className="pill">{getNotificationTypeLabel(notification.type)}</span></td>
              <td>
                <div className="data-table__primary">{notification.title}</div>
              </td>
              <td>
                <div className="data-table__secondary" style={{ maxWidth: 320 }}>{notification.body}</div>
              </td>
              <td><span className="pill">{notification.channel}</span></td>
              <td>{formatDateTime(notification.scheduledFor)}</td>
              <td>
                <div className="data-table__row-actions">
                  {targetHref && (
                    <Link href={targetHref} className="button button--sm button--ghost">View</Link>
                  )}
                  {!notification.readAt && notification.status !== "read" ? (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <button type="submit" className="button button--sm button--primary">Mark Read</button>
                    </form>
                  ) : (
                    <form action={markNotificationUnreadAction}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <button type="submit" className="button button--sm button--ghost">Undo</button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps): Promise<JSX.Element> {
  const t = await getTranslations("notifications");
  const tCommon = await getTranslations("common");
  const params = searchParams ? await searchParams : {};
  const prefs = await getDisplayPreferences().catch(() => ({ pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" }));
  const status = typeof params.status === "string" && statusOptions.includes(params.status as (typeof statusOptions)[number])
    ? params.status as (typeof statusOptions)[number]
    : "all";
  const channel = typeof params.channel === "string" && channelOptions.includes(params.channel as (typeof channelOptions)[number])
    ? params.channel as (typeof channelOptions)[number]
    : "all";
  const type = typeof params.type === "string" && typeOptions.includes(params.type as (typeof typeOptions)[number])
    ? params.type as (typeof typeOptions)[number]
    : "all";
  const limit = typeof params.limit === "string" && limitOptions.includes(Number(params.limit) as (typeof limitOptions)[number])
    ? Number(params.limit)
    : prefs.pageSize;
  const cursor = typeof params.cursor === "string" ? params.cursor : undefined;
  const history = typeof params.history === "string"
    ? params.history.split(",").map((value) => value.trim()).filter(Boolean)
    : [];

  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return (
      <>
        <header className="page-header"><h1>{t("pageTitle")}</h1></header>
        <div className="page-body">
          <p>{tCommon("empty.noHousehold")} <Link href="/" className="text-link">{tCommon("actions.goToDashboard")}</Link> to create one.</p>
        </div>
      </>
    );
  }

  const notificationsSkeleton = (
    <section className="panel">
      <div className="panel__header">
        <div className="skeleton-bar" style={{ width: 160, height: 20 }} />
      </div>
      <div className="panel__body">
        <table className="data-table" aria-hidden="true">
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                <td><div className="skeleton-bar" style={{ width: 56, height: 22, borderRadius: 12 }} /></td>
                <td><div className="skeleton-bar" style={{ width: 80, height: 22, borderRadius: 12 }} /></td>
                <td><div className="skeleton-bar" style={{ width: 200, height: 14 }} /></td>
                <td><div className="skeleton-bar" style={{ width: 280, height: 14 }} /></td>
                <td><div className="skeleton-bar" style={{ width: 54, height: 22, borderRadius: 12 }} /></td>
                <td><div className="skeleton-bar" style={{ width: 100, height: 14 }} /></td>
                <td><div className="skeleton-bar" style={{ width: 80, height: 30, borderRadius: 6 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <Suspense fallback={<><header className="page-header"><h1>{t("pageTitle")}</h1></header><div className="page-body">{notificationsSkeleton}</div></>}>
      <NotificationsContent
        householdId={household.id}
        status={status}
        channel={channel}
        type={type}
        limit={limit}
        cursor={cursor}
        history={history}
      />
    </Suspense>
  );
}

async function NotificationsContent({ householdId, status, channel, type, limit, cursor, history }: {
  householdId: string;
  status: (typeof statusOptions)[number];
  channel: (typeof channelOptions)[number];
  type: (typeof typeOptions)[number];
  limit: number;
  cursor: string | undefined;
  history: string[];
}): Promise<JSX.Element> {
  const t = await getTranslations("notifications");

  try {
    const notificationList = await getHouseholdNotifications(householdId, {
      limit,
      status,
      ...(cursor ? { cursor } : {}),
      ...(channel !== "all" ? { channel } : {}),
      ...(type !== "all" ? { type } : {})
    });
    const filteredNotifications = notificationList.notifications;
    const visibleUnreadNotifications = filteredNotifications.filter((notification) => !notification.readAt && notification.status !== "read");
    const visibleReadNotifications = filteredNotifications.filter((notification) => notification.readAt || notification.status === "read");
    const overdueNotifications = filteredNotifications.filter((notification) => getNotificationBucket(notification) === "overdue");
    const dueSoonNotifications = filteredNotifications.filter((notification) => getNotificationBucket(notification) === "dueSoon");
    const informationalNotifications = filteredNotifications.filter((notification) => getNotificationBucket(notification) === "informational");
    return (
      <>
        <header className="page-header">
          <h1>{t("pageTitle")}</h1>
          <div className="page-header__actions">
            {visibleUnreadNotifications.length > 0 ? (
              <form action={markNotificationsReadAction}>
                {visibleUnreadNotifications.map((notification) => (
                  <input key={notification.id} type="hidden" name="notificationId" value={notification.id} />
                ))}
                <button type="submit" className="button button--primary">{t("markVisibleRead")}</button>
              </form>
            ) : null}
            {visibleReadNotifications.length > 0 ? (
              <form action={markNotificationsUnreadAction}>
                {visibleReadNotifications.map((notification) => (
                  <input key={notification.id} type="hidden" name="notificationId" value={notification.id} />
                ))}
                <button type="submit" className="button button--ghost">{t("undoVisibleRead")}</button>
              </form>
            ) : null}
            <p className="note">{t("backgroundNote")}</p>
          </div>
        </header>

        <div className="page-body">
          <section className="panel">
            <div className="panel__header">
              <h2>{t("filters")}</h2>
            </div>
            <div className="panel__body--padded">
              <form method="GET" className="form-grid">
                <label className="field">
                  <span>Status</span>
                  <select name="status" defaultValue={status}>
                    <option value="all">All</option>
                    <option value="unread">Unread</option>
                    <option value="read">Read</option>
                  </select>
                </label>
                <label className="field">
                  <span>Channel</span>
                  <select name="channel" defaultValue={channel}>
                    <option value="all">All channels</option>
                    <option value="push">Push</option>
                    <option value="email">Email</option>
                    <option value="digest">Digest</option>
                  </select>
                </label>
                <label className="field">
                  <span>Type</span>
                  <select name="type" defaultValue={type}>
                    <option value="all">All types</option>
                    <option value="overdue">Overdue</option>
                    <option value="due">Due now</option>
                    <option value="due_soon">Due soon</option>
                    <option value="inventory_low_stock">Low stock</option>
                    <option value="announcement">Announcement</option>
                    <option value="digest">Digest</option>
                  </select>
                </label>
                <label className="field">
                  <span>Page Size</span>
                  <select name="limit" defaultValue={String(limit)}>
                    <option value="25">25 notifications</option>
                    <option value="50">50 notifications</option>
                    <option value="100">100 notifications</option>
                  </select>
                </label>
                <div className="inline-actions field field--full">
                  <button type="submit" className="button button--ghost">Apply Filters</button>
                  <Link href="/notifications" className="button button--ghost">Reset</Link>
                </div>
              </form>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Triage Overview</h2>
              <span className="pill">{notificationList.unreadCount} unread total</span>
            </div>
            <div className="panel__body--padded">
              <section className="stats-row">
                <div className="stat-card stat-card--danger">
                  <span className="stat-card__label">Overdue</span>
                  <strong className="stat-card__value">{overdueNotifications.length}</strong>
                </div>
                <div className="stat-card stat-card--warning">
                  <span className="stat-card__label">Due Soon</span>
                  <strong className="stat-card__value">{dueSoonNotifications.length}</strong>
                </div>
                <div className="stat-card stat-card--accent">
                  <span className="stat-card__label">Informational</span>
                  <strong className="stat-card__value">{informationalNotifications.length}</strong>
                </div>
                <div className="stat-card">
                  <span className="stat-card__label">Visible</span>
                  <strong className="stat-card__value">{filteredNotifications.length}</strong>
                </div>
              </section>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Overdue Alerts ({overdueNotifications.length})</h2>
            </div>
            <div className="panel__body">
              {overdueNotifications.length === 0 ? (
                <p className="panel__empty">No overdue alerts match the current filters.</p>
              ) : (
                <NotificationTable notifications={overdueNotifications} />
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Due Soon & Action Items ({dueSoonNotifications.length})</h2>
            </div>
            <div className="panel__body">
              {dueSoonNotifications.length === 0 ? (
                <p className="panel__empty">No due-soon or low-stock notifications match the current filters.</p>
              ) : (
                <NotificationTable notifications={dueSoonNotifications} />
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Informational ({informationalNotifications.length})</h2>
            </div>
            <div className="panel__body">
              {informationalNotifications.length === 0 ? (
                <p className="panel__empty">No informational notifications match the current filters.</p>
              ) : (
                <NotificationTable notifications={informationalNotifications} />
              )}
            </div>
          </section>

          <CursorPaginationControls
            nextCursor={notificationList.nextCursor ?? null}
            currentCursor={cursor}
            cursorHistory={history}
            limit={limit}
            resultCount={filteredNotifications.length}
            entityLabel="notifications"
            buildHref={({ cursor: c, history: h, limit: l }) =>
              buildNotificationsHref({ status, channel, type, limit: l, cursor: c, history: h })
            }
          />
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
