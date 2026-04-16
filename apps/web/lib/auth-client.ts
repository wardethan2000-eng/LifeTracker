import { createAuthClient } from "better-auth/client";

// Use the current page origin in the browser so auth works from any domain
// (lifetracker.home, Tailscale hostname, etc.) — nginx proxies /api/auth/
// to the API on all server names. Fall back to the env var for SSR contexts.
const apiBaseUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_LIFEKEEPER_API_BASE_URL ?? "http://localhost:4000");

export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
});
