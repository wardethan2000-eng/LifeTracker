import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";
import type { FastifyServerOptions } from "fastify";

const DEFAULT_DEV_BODY_LIMIT_BYTES = 1_048_576;
const DEFAULT_PROD_BODY_LIMIT_BYTES = 262_144;
const DEFAULT_DEV_MAX_PARAM_LENGTH = 200;
const DEFAULT_PROD_MAX_PARAM_LENGTH = 120;
const DEFAULT_DEV_GLOBAL_RATE_LIMIT_MAX = 300;
const DEFAULT_PROD_GLOBAL_RATE_LIMIT_MAX = 120;
const DEFAULT_GLOBAL_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_DEV_CORS_ORIGINS = [
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "http://localhost:8081"
];

const parseList = (value: string | undefined): string[] => value
  ?.split(",")
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0) ?? [];

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
};

const isProductionEnvironment = (): boolean => process.env.NODE_ENV === "production";

const resolveDefaultBodyLimitBytes = (): number => isProductionEnvironment()
  ? DEFAULT_PROD_BODY_LIMIT_BYTES
  : DEFAULT_DEV_BODY_LIMIT_BYTES;

const resolveDefaultMaxParamLength = (): number => isProductionEnvironment()
  ? DEFAULT_PROD_MAX_PARAM_LENGTH
  : DEFAULT_DEV_MAX_PARAM_LENGTH;

const resolveDefaultGlobalRateLimitMax = (): number => isProductionEnvironment()
  ? DEFAULT_PROD_GLOBAL_RATE_LIMIT_MAX
  : DEFAULT_DEV_GLOBAL_RATE_LIMIT_MAX;

const normalizeOrigin = (value: string): string => {
  try {
    return new URL(value).origin;
  } catch {
    return value.trim().replace(/\/+$/, "");
  }
};

export const resolveAllowedCorsOrigins = (): Set<string> => {
  const configuredOrigins = [
    ...parseList(process.env.CORS_ALLOWED_ORIGINS),
    process.env.APP_BASE_URL?.trim(),
    ...parseList(process.env.CLERK_AUTHORIZED_PARTIES)
  ].filter((origin): origin is string => Boolean(origin));

  if (configuredOrigins.length === 0 && process.env.NODE_ENV !== "production") {
    return new Set(DEFAULT_DEV_CORS_ORIGINS.map(normalizeOrigin));
  }

  return new Set(configuredOrigins.map(normalizeOrigin));
};

export const resolveApiServerOptions = (): Pick<FastifyServerOptions, "bodyLimit" | "routerOptions"> => ({
  bodyLimit: parsePositiveInt(process.env.API_BODY_LIMIT_BYTES, resolveDefaultBodyLimitBytes()),
  routerOptions: {
    maxParamLength: parsePositiveInt(process.env.API_MAX_PARAM_LENGTH, resolveDefaultMaxParamLength())
  }
});

export const resolveGlobalRateLimitOptions = (): { max: number; timeWindow: number } => ({
  max: parsePositiveInt(process.env.GLOBAL_RATE_LIMIT_MAX, resolveDefaultGlobalRateLimitMax()),
  timeWindow: parsePositiveInt(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS, DEFAULT_GLOBAL_RATE_LIMIT_WINDOW_MS)
});

export const securityPlugin = fp(async (app) => {
  const allowedCorsOrigins = resolveAllowedCorsOrigins();
  const rateLimitOptions = resolveGlobalRateLimitOptions();

  if (process.env.NODE_ENV === "production" && allowedCorsOrigins.size === 0) {
    throw new Error("Configure CORS_ALLOWED_ORIGINS or APP_BASE_URL before starting the API in production.");
  }

  await app.register(cors, {
    credentials: true,
    strictPreflight: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Dev-User-Id", "X-User-Id"],
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (origin === "null") {
        app.log.warn({ origin }, "Rejected CORS origin.");
        callback(null, false);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);
      const allowed = allowedCorsOrigins.has(normalizedOrigin);

      if (!allowed) {
        app.log.warn({ origin: normalizedOrigin }, "Rejected CORS origin.");
      }

      callback(null, allowed);
    }
  });

  await app.register(rateLimit, {
    global: true,
    hook: "onRequest",
    max: rateLimitOptions.max,
    timeWindow: rateLimitOptions.timeWindow,
    keyGenerator: (request) => request.ip,
    allowList: (request) => request.method === "OPTIONS" || request.url === "/health",
    skipOnError: true,
    errorResponseBuilder: (_request, context) => ({
      statusCode: context.statusCode,
      message: "Too many requests. Try again shortly."
    })
  });
});