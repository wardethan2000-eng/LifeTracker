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

// Delegates all /api/auth/* requests to the BetterAuth handler.
// This route is registered in the PUBLIC scope (before the auth preHandler) so
// sign-in / sign-up / session endpoints are accessible without a session.
export const authRoutes: FastifyPluginAsync = async (app) => {
  app.route({
    url: "/api/auth/*",
    method: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    handler: async (request, reply) => {
      const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
      const host = request.headers.host ?? "localhost:4000";
      const url = `${protocol}://${host}${request.url}`;

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
