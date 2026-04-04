import type { FastifyReply, FastifyRequest } from "fastify";

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

const pruneTimestamps = (timestamps: number[], windowMs: number, now: number): number[] => (
  timestamps.filter((timestamp) => now - timestamp < windowMs)
);

const consumeRateLimit = async (scope: string, key: string, windowMs: number): Promise<RateLimitConsumeResult> => {
  const now = Date.now();
  const bucketKey = `${scope}:${key}`;
  const existing = rateLimitBuckets.get(bucketKey);
  const timestamps = pruneTimestamps(existing?.timestamps ?? [], windowMs, now);
  timestamps.push(now);

  rateLimitBuckets.set(bucketKey, { windowMs, timestamps });

  const oldestTimestamp = timestamps[0] ?? now;
  return {
    count: timestamps.length,
    resetAt: oldestTimestamp + windowMs,
  };
};

const evaluateRateLimit = async ({ scope, max, windowMs, key }: Omit<RateLimitPolicy, "message">): Promise<RateLimitState> => {
  const result = await consumeRateLimit(scope, key, windowMs);
  const limited = result.count > max;

  return {
    limited,
    remaining: Math.max(0, max - result.count),
    resetAt: result.resetAt,
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
    path: request.url,
  }, "Rate limit exceeded");
  void reply.code(429).send({
    message: policy.message,
    retryAfter: retryAfterSeconds,
    scope: policy.scope,
    limit: policy.max,
    windowSeconds: Math.ceil(policy.windowMs / 1000),
  });
  return true;
};

export const buildRateLimitKey = (
  request: FastifyRequest,
  discriminator?: string
): string => [request.ip, discriminator].filter(Boolean).join(":");

export const resetRateLimitState = async (): Promise<void> => {
  rateLimitBuckets.clear();
};

setInterval(() => {
  const now = Date.now();

  for (const [key, bucket] of rateLimitBuckets.entries()) {
    const recent = pruneTimestamps(bucket.timestamps, bucket.windowMs, now);

    if (recent.length === 0) {
      rateLimitBuckets.delete(key);
    } else {
      rateLimitBuckets.set(key, { windowMs: bucket.windowMs, timestamps: recent });
    }
  }
}, 10 * 60 * 1000).unref();
