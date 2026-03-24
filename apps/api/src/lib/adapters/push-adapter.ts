export interface SendPushOptions {
  userId: string;
  title: string;
  body: string;
  type: string;
  payload: unknown;
}

/**
 * In-app push adapter.
 *
 * Notifications are already persisted as Notification records and surfaced on
 * the /notifications page, so no additional delivery step is required here.
 * This adapter exists to maintain the pluggable contract for future
 * FCM/APNS integration.
 */
export const sendPush = async (_options: SendPushOptions): Promise<void> => {
  // no-op: in-app push is delivered via the notification inbox
};
