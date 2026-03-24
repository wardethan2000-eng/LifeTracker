import { Redis } from "ioredis";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getRedisConnectionOptions } from "./redis.js";

type RateLimitPolicy = {
  scope: string;
  max: number;
  windowMs: number;
  key: string;
  message: string;
};

type RateLimitBucket = {
  windowMs: number;
  timestamps: number[];
};

type RateLimitConsumeResult = {
  count: number;
  resetAt: number;
};

type RateLimitState = {
  limited: boolean;
  remaining: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();
let rateLimitRedis: Redis | undefined;
let redisFailureLoggedAt = 0;

const pruneTimestamps = (timestamps: number[], windowMs: number, now: number): number[] => (
  timestamps.filter((timestamp) => now - timestamp < windowMs)
);

const consumeInMemory = async (scope: string, key: string, windowMs: number): Promise<RateLimitConsumeResult> => {
  const now = Date.now();
  const bucketKey = `${scope}:${key}`;
  const existing = rateLimitBuckets.get(bucketKey);
  const timestamps = pruneTimestamps(existing?.timestamps ?? [], windowMs, now);
  timestamps.push(now);

  rateLimitBuckets.set(bucketKey, {
    windowMs,
    timestamps
  });

  const oldestTimestamp = timestamps[0] ?? now;
  return {
    count: timestamps.length,
    resetAt: oldestTimestamp + windowMs
  };
};

const getRateLimitRedis = (): Redis => {
  if (!rateLimitRedis) {
    rateLimitRedis = new Redis({
      ...getRedisConnectionOptions(),
      lazyConnect: true,
      enableOfflineQueue: false
    });
  }

  return rateLimitRedis;
};

const consumeWithRedis = async (scope: string, key: string, windowMs: number): Promise<RateLimitConsumeResult> => {
  const redis = getRateLimitRedis();
  const redisKey = `rate-limit:${scope}:${key}`;
  const result = await redis.eval(
    `
      local current = redis.call("INCR", KEYS[1])
      if current == 1 then
        redis.call("PEXPIRE", KEYS[1], ARGV[1])
      end
      local ttl = redis.call("PTTL", KEYS[1])
      return { current, ttl }
    `,
    1,
    redisKey,
    windowMs.toString()
  ) as [number, number];

  const count = Number(result[0] ?? 0);
  const ttl = Number(result[1] ?? windowMs);

  return {
    count,
    resetAt: Date.now() + Math.max(ttl, 0)
  };
};

const consumeRateLimit = async (scope: string, key: string, windowMs: number): Promise<RateLimitConsumeResult> => {
  if (process.env.RATE_LIMIT_STORE === "memory" || process.env.NODE_ENV === "test") {
    return consumeInMemory(scope, key, windowMs);
  }

  try {
    return await consumeWithRedis(scope, key, windowMs);
  } catch (error) {
    const now = Date.now();

    if (now - redisFailureLoggedAt > 60_000) {
      redisFailureLoggedAt = now;
      console.error("Rate limit Redis unavailable, falling back to in-memory limiter.", error);
    }

    return consumeInMemory(scope, key, windowMs);
  }
};

const evaluateRateLimit = async ({ scope, max, windowMs, key }: Omit<RateLimitPolicy, "message">): Promise<RateLimitState> => {
  const result = await consumeRateLimit(scope, key, windowMs);
  const limited = result.count > max;

  return {
    limited,
    remaining: Math.max(0, max - result.count),
    resetAt: result.resetAt
  };
};

const setRateLimitHeaders = (reply: FastifyReply, policy: RateLimitPolicy, state: RateLimitState): void => {
  reply.header("x-ratelimit-limit", policy.max.toString());
  reply.header("x-ratelimit-remaining", state.remaining.toString());
  reply.header("x-ratelimit-reset", Math.ceil(state.resetAt / 1000).toString());
};

export const enforceRateLimit = async (request: FastifyRequest, reply: FastifyReply, policy: RateLimitPolicy): Promise<boolean> => {
  const state = await evaluateRateLimit(policy);
  setRateLimitHeaders(reply, policy, state);

  if (!state.limited) {
    return false;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((state.resetAt - Date.now()) / 1000));
  reply.header("retry-after", retryAfterSeconds.toString());
  const auth = request.auth as { userId?: string } | undefined;
  request.log.warn({
    event: "rate_limit_exceeded",
    userId: auth?.userId ?? null,
    ip: request.ip,
    scope: policy.scope,
    limit: policy.max,
    windowMs: policy.windowMs,
    path: request.url
  }, "Rate limit exceeded");
  void reply.code(429).send({
    message: policy.message,
    retryAfter: retryAfterSeconds,
    scope: policy.scope,
    limit: policy.max,
    windowSeconds: Math.ceil(policy.windowMs / 1000)
  });
  return true;
};

export const buildRateLimitKey = (
  request: FastifyRequest,
  discriminator?: string
): string => [request.ip, discriminator].filter(Boolean).join(":");

export const resetRateLimitState = async (): Promise<void> => {
  rateLimitBuckets.clear();

  if (rateLimitRedis) {
    await rateLimitRedis.quit().catch(() => {});
    rateLimitRedis = undefined;
  }
};

setInterval(() => {
  const now = Date.now();

  for (const [key, bucket] of rateLimitBuckets.entries()) {
    const recent = pruneTimestamps(bucket.timestamps, bucket.windowMs, now);

    if (recent.length === 0) {
      rateLimitBuckets.delete(key);
    } else {
      rateLimitBuckets.set(key, {
        windowMs: bucket.windowMs,
        timestamps: recent
      });
    }
  }
}, 10 * 60 * 1000).unref();
