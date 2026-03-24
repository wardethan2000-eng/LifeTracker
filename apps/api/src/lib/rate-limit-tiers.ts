import type { FastifyReply, FastifyRequest } from "fastify";
import { enforceRateLimit } from "./rate-limit.js";

export type RateLimitTier = "heavy-analytics" | "pdf-export" | "bulk-export" | "search";

type TierConfig = {
  max: number;
  windowMs: number;
  message: string;
};

const TIER_CONFIGS: Record<RateLimitTier, TierConfig> = {
  "heavy-analytics": {
    max: 10,
    windowMs: 60_000,
    message: "Rate limit exceeded for analytics endpoints. Try again shortly."
  },
  "pdf-export": {
    max: 3,
    windowMs: 60_000,
    message: "Rate limit exceeded for PDF export endpoints. Try again shortly."
  },
  "bulk-export": {
    max: 5,
    windowMs: 60_000,
    message: "Rate limit exceeded for export endpoints. Try again shortly."
  },
  "search": {
    max: 30,
    windowMs: 60_000,
    message: "Rate limit exceeded for search. Try again shortly."
  }
};

/**
 * Apply a tier-based rate limit keyed by authenticated user.
 * Returns true and sends a 429 response if the user has exceeded the tier's limit.
 * Only call this from authenticated route handlers or preHandler hooks.
 */
export const applyTier = async (
  request: FastifyRequest,
  reply: FastifyReply,
  tier: RateLimitTier
): Promise<boolean> => {
  const config = TIER_CONFIGS[tier];
  return enforceRateLimit(request, reply, {
    scope: tier,
    key: `user:${request.auth.userId}`,
    max: config.max,
    windowMs: config.windowMs,
    message: config.message
  });
};
