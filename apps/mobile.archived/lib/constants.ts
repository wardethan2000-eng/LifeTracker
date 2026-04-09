import { devFixtureIds } from "@aegis/types";

/**
 * API base URL. In local development this points to the Fastify server at :4000.
 * In production this is overridden by the EAS build environment variable.
 */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_AEGIS_API_BASE_URL?.trim() ??
  "http://127.0.0.1:4000"
).replace(/\/+$/, "");

/**
 * Dev user ID injected as x-dev-user-id header when __DEV__ is true.
 * Bypasses Clerk auth entirely during local development.
 */
export const DEV_USER_ID =
  process.env.EXPO_PUBLIC_AEGIS_DEV_USER_ID?.trim() ||
  devFixtureIds.ownerUserId;

/**
 * Clerk publishable key. Empty string in dev mode (Clerk is bypassed).
 */
export const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "";

/**
 * Whether offline mode writes should be queued.
 * Always true — mutations queue and flush automatically.
 */
export const OFFLINE_QUEUE_ENABLED = true;

/**
 * Maximum number of entries to show in recent search history.
 */
export const MAX_RECENT_SEARCHES = 20;

/**
 * MMKV storage keys.
 */
export const STORAGE_KEYS = {
  MUTATION_QUEUE: "offline_mutation_queue",
  UPLOAD_QUEUE: "offline_upload_queue",
  RECENT_SEARCHES: "recent_searches",
  USER_PREFERENCES: "user_preferences",
  COLOR_SCHEME: "color_scheme",
  DEVICE_TOKEN_ID: "push_device_token_id",
} as const;

/**
 * React Query default options.
 */
export const QUERY_DEFAULTS = {
  staleTime: 5 * 60 * 1000,        // 5 minutes
  gcTime: 24 * 60 * 60 * 1000,     // 24 hours
  retryCount: 2,
} as const;
