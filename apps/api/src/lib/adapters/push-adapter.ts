export interface SendPushOptions {
  userId: string;
  title: string;
  body: string;
  type: string;
  payload: unknown;
  /** Expo push tokens registered for this user. If empty, no push is sent. */
  expoPushTokens?: string[];
}

// Expo Push Notifications HTTP API
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  priority?: "default" | "normal" | "high";
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Sends push notifications to the user's registered Expo devices.
 *
 * Uses Expo's push notification service which abstracts over FCM (Android)
 * and APNs (iOS). No Firebase project setup required.
 *
 * Notifications are also persisted as Notification records and surfaced in
 * the in-app notification center.
 */
export const sendPush = async (options: SendPushOptions): Promise<void> => {
  const tokens = options.expoPushTokens ?? [];
  if (tokens.length === 0) return;

  const data = (typeof options.payload === "object" && options.payload !== null)
    ? options.payload as Record<string, unknown>
    : {};

  const messages: ExpoPushMessage[] = tokens.map((token) => ({
    to: token,
    title: options.title,
    body: options.body,
    data: { type: options.type, ...data },
    sound: "default",
    priority: "high",
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    console.error(`[push-adapter] Expo push API error ${response.status}: ${text}`);
    return;
  }

  const result = (await response.json()) as { data: ExpoPushTicket[] };
  for (const ticket of result.data ?? []) {
    if (ticket.status === "error") {
      console.warn(`[push-adapter] Push ticket error: ${ticket.message}`, ticket.details);
    }
  }
};
