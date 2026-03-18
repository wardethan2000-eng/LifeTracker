import { Writable } from "node:stream";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { destructiveAuditLogPlugin } from "../src/plugins/destructive-audit-log.js";
import { resolveApiServerOptions, resolveGlobalRateLimitOptions, securityPlugin } from "../src/plugins/security.js";

const originalEnv = { ...process.env };
const userId = "clkeeperuser0000000000001";

const createLogStream = () => {
  const chunks: string[] = [];

  return {
    chunks,
    stream: new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      }
    })
  };
};

const parseLogEntries = (chunks: string[]): Array<Record<string, unknown>> => chunks
  .flatMap((chunk) => chunk.split(/\r?\n/))
  .map((line) => line.trim())
  .filter((line) => line.length > 0)
  .map((line) => JSON.parse(line) as Record<string, unknown>);

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("API security hardening", () => {
  it("uses stricter production defaults when overrides are absent", () => {
    process.env.NODE_ENV = "production";
    delete process.env.API_BODY_LIMIT_BYTES;
    delete process.env.API_MAX_PARAM_LENGTH;
    delete process.env.GLOBAL_RATE_LIMIT_MAX;
    delete process.env.GLOBAL_RATE_LIMIT_WINDOW_MS;

    expect(resolveApiServerOptions()).toMatchObject({
      bodyLimit: 262_144,
      routerOptions: {
        maxParamLength: 120
      }
    });
    expect(resolveGlobalRateLimitOptions()).toEqual({
      max: 120,
      timeWindow: 60_000
    });
  });

  it("only reflects configured CORS origins", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";

    const app = Fastify({
      ...resolveApiServerOptions()
    });

    await app.register(securityPlugin);
    app.get("/probe", async () => ({ ok: true }));

    try {
      const allowed = await app.inject({
        method: "GET",
        url: "/probe",
        headers: {
          origin: "https://app.example.com"
        }
      });

      const rejected = await app.inject({
        method: "GET",
        url: "/probe",
        headers: {
          origin: "https://evil.example.com"
        }
      });

      expect(allowed.statusCode).toBe(200);
      expect(allowed.headers["access-control-allow-origin"]).toBe("https://app.example.com");
      expect(rejected.statusCode).toBe(200);
      expect(rejected.headers["access-control-allow-origin"]).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("rejects bodies larger than the configured body limit", async () => {
    process.env.API_BODY_LIMIT_BYTES = "32";

    const app = Fastify({
      ...resolveApiServerOptions()
    });

    await app.register(securityPlugin);
    app.post("/probe", async () => ({ ok: true }));

    try {
      const response = await app.inject({
        method: "POST",
        url: "/probe",
        payload: {
          message: "x".repeat(128)
        }
      });

      expect(response.statusCode).toBe(413);
    } finally {
      await app.close();
    }
  });

  it("enforces the global Fastify rate limit", async () => {
    process.env.GLOBAL_RATE_LIMIT_MAX = "2";
    process.env.GLOBAL_RATE_LIMIT_WINDOW_MS = "60000";

    const app = Fastify({
      ...resolveApiServerOptions()
    });

    await app.register(securityPlugin);
    app.get("/limited", async () => ({ ok: true }));

    try {
      const first = await app.inject({ method: "GET", url: "/limited" });
      const second = await app.inject({ method: "GET", url: "/limited" });
      const third = await app.inject({ method: "GET", url: "/limited" });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      expect(third.statusCode).toBe(429);
      expect(third.json()).toMatchObject({
        message: "Too many requests. Try again shortly."
      });
    } finally {
      await app.close();
    }
  });

  it("logs destructive requests with redacted audit metadata", async () => {
    const { chunks, stream } = createLogStream();
    const app = Fastify({
      ...resolveApiServerOptions(),
      logger: {
        level: "info",
        stream
      }
    });

    app.decorateRequest("auth", undefined as never);
    app.addHook("preHandler", async (request) => {
      request.auth = {
        userId,
        clerkUserId: null,
        source: "dev-bypass"
      };
    });

    await app.register(destructiveAuditLogPlugin);
    app.delete("/v1/widgets/:widgetId", async (request, reply) => {
      const params = request.params as { widgetId: string };

      request.auditLogContext = {
        action: "widget.deleted",
        entityType: "widget",
        entityId: params.widgetId,
        metadata: {
          reason: "duplicate",
          token: "super-secret-token"
        }
      };

      return reply.code(204).send();
    });

    try {
      const response = await app.inject({
        method: "DELETE",
        url: "/v1/widgets/widget-123?force=true",
        payload: {
          note: "safe context",
          authorization: "Bearer secret",
          nested: {
            password: "super-secret",
            keep: "visible"
          }
        }
      });

      expect(response.statusCode).toBe(204);

      const auditEntry = parseLogEntries(chunks).find((entry) => entry.msg === "Destructive operation audit.");
      expect(auditEntry).toBeDefined();

      const audit = auditEntry?.audit as Record<string, unknown>;
      expect(audit.userId).toBe(userId);
      expect(audit.method).toBe("DELETE");
      expect(audit.route).toBe("/v1/widgets/:widgetId");
      expect(audit.params).toEqual({ widgetId: "widget-123" });
      expect(audit.query).toEqual({ force: "true" });
      expect(audit.body).toEqual({
        note: "safe context",
        authorization: "[Redacted]",
        nested: {
          password: "[Redacted]",
          keep: "visible"
        }
      });
      expect(audit.context).toEqual({
        action: "widget.deleted",
        entityType: "widget",
        entityId: "widget-123",
        metadata: {
          reason: "duplicate",
          token: "[Redacted]"
        }
      });
    } finally {
      await app.close();
    }
  });
});