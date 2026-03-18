import fp from "fastify-plugin";
import type { FastifyRequest } from "fastify";

export interface RequestAuditLogContext {
  action?: string;
  entityType?: string;
  entityId?: string;
  householdId?: string;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEYS = new Set([
  "accesskey",
  "accesskeyid",
  "apikey",
  "authorization",
  "cookie",
  "password",
  "secret",
  "set-cookie",
  "token"
]);
const DESTRUCTIVE_ROUTE_SEGMENTS = new Set(["archive", "revoke"]);
const MAX_AUDIT_DEPTH = 4;
const MAX_AUDIT_ARRAY_ITEMS = 25;
const MAX_AUDIT_STRING_LENGTH = 256;

const getRoutePath = (request: FastifyRequest): string => request.routeOptions.url ?? request.url.split("?")[0] ?? request.url;

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const sanitizeForAudit = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (depth >= MAX_AUDIT_DEPTH) {
    return "[Truncated]";
  }

  if (typeof value === "string") {
    return value.length > MAX_AUDIT_STRING_LENGTH
      ? `${value.slice(0, MAX_AUDIT_STRING_LENGTH)}...`
      : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_AUDIT_ARRAY_ITEMS).map((entry) => sanitizeForAudit(entry, depth + 1));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, "");

        return [
          key,
          SENSITIVE_KEYS.has(normalizedKey)
            ? "[Redacted]"
            : sanitizeForAudit(entry, depth + 1)
        ];
      })
    );
  }

  return String(value);
};

const isDestructiveOperation = (request: FastifyRequest): boolean => {
  if (request.method === "DELETE") {
    return true;
  }

  return getRoutePath(request)
    .split("/")
    .some((segment) => DESTRUCTIVE_ROUTE_SEGMENTS.has(segment));
};

export const destructiveAuditLogPlugin = fp(async (app) => {
  app.decorateRequest("auditLogContext", null);

  app.addHook("onResponse", async (request, reply) => {
    if (!isDestructiveOperation(request)) {
      return;
    }

    const auditEntry = {
      requestId: request.id,
      method: request.method,
      route: getRoutePath(request),
      url: request.url,
      statusCode: reply.statusCode,
      ip: request.ip,
      userId: request.auth?.userId ?? null,
      authSource: request.auth?.source ?? null,
      params: sanitizeForAudit(request.params),
      query: sanitizeForAudit(request.query),
      body: sanitizeForAudit(request.body),
      context: sanitizeForAudit(request.auditLogContext)
    };

    if (reply.statusCode >= 500) {
      request.log.error({ audit: auditEntry }, "Destructive operation audit.");
      return;
    }

    if (reply.statusCode >= 400) {
      request.log.warn({ audit: auditEntry }, "Destructive operation audit.");
      return;
    }

    request.log.info({ audit: auditEntry }, "Destructive operation audit.");
  });
});