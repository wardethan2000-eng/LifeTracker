import type { FastifyPluginAsync } from "fastify";
import { auth } from "../lib/auth.js";

// Converts Fastify's Node.js headers into a Web API Headers object.
const toWebHeaders = (raw: Record<string, string | string[] | undefined>): Headers => {
  const headers = new Headers();

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, v);
      }
    }
  }

  return headers;
};

const firstHeaderValue = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  return Array.isArray(value) ? value[0] : undefined;
};

const stripHeaderArtifacts = (value: string): string => value
  .trim()
  .replace(/^\\+/, "")
  .replace(/^"+|"+$/g, "");

const resolveProtocol = (forwardedProto: string | string[] | undefined): "http" | "https" => {
  const fallback = process.env.APP_BASE_URL?.startsWith("https") ? "https" : "http";
  const candidate = firstHeaderValue(forwardedProto)
    ?.split(",")[0]
    .trim();

  if (!candidate) {
    return fallback;
  }

  const normalized = stripHeaderArtifacts(candidate)
    .replace(/:.*$/, "")
    .toLowerCase();

  return normalized === "https" ? "https" : normalized === "http" ? "http" : fallback;
};

const resolveHost = (
  forwardedHost: string | string[] | undefined,
  hostHeader: string | string[] | undefined
): string => {
  const candidate = firstHeaderValue(forwardedHost ?? hostHeader)
    ?.split(",")[0]
    .trim();

  if (!candidate) {
    return "localhost:4000";
  }

  const normalized = stripHeaderArtifacts(candidate);

  try {
    return new URL(normalized).host || "localhost:4000";
  } catch {
    return normalized
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "") || "localhost:4000";
  }
};

// Delegates all /api/auth/* requests to the BetterAuth handler.
// This route is registered in the PUBLIC scope (before the auth preHandler) so
// sign-in / sign-up / session endpoints are accessible without a session.
export const authRoutes: FastifyPluginAsync = async (app) => {
  app.route({
    url: "/api/auth/*",
    method: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    handler: async (request, reply) => {
      // Prefer X-Forwarded-Proto set by a reverse proxy (e.g. nginx) so that
      // BetterAuth constructs cookies with the correct Secure flag.  Falling
      // back to the APP_BASE_URL scheme keeps local dev working without a proxy.
      const protocol = resolveProtocol(request.headers["x-forwarded-proto"]);
      const host = resolveHost(request.headers["x-forwarded-host"], request.headers.host);
      const url = new URL(request.url, `${protocol}://${host}`).toString();

      const hasBody =
        request.method !== "GET" &&
        request.method !== "HEAD" &&
        request.body != null;

      const webRequest = new Request(url, {
        method: request.method,
        headers: toWebHeaders(request.headers),
        body: hasBody ? JSON.stringify(request.body) : undefined,
      });

      const response = await auth.handler(webRequest);

      reply.status(response.status);
      for (const [key, value] of response.headers.entries()) {
        reply.header(key, value);
      }

      const body = await response.arrayBuffer();
      return reply.send(Buffer.from(body));
    },
  });
};
