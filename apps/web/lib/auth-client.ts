import { createAuthClient } from "better-auth/client";

// The BetterAuth handler lives on the Fastify API server.
// Reuses the same API base URL env var as the rest of the web app.
const apiBaseUrl =
  process.env.NEXT_PUBLIC_LIFEKEEPER_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
});
