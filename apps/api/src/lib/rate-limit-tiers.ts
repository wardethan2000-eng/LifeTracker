import type { FastifyReply, FastifyRequest } from "fastify";
import { buildRateLimitKey, enforceRateLimit } from "./rate-limit.js";

// Re-export buildRateLimitKey so callers only need to import from this module.
export { buildRateLimitKey };

/**
 * Named rate-limit tiers.
 *
 * **User-keyed tiers** (authenticated routes, key = `user:<userId>`):
 *   heavy-analytics, pdf-export, bulk-export, search
 *
 * **IP-keyed tiers** (public or partially-public routes, key supplied by caller
 *   via `buildRateLimitKey`):
 *   barcode         – barcode lookup, 20 req / 5 min per IP+user
 *   barcode-image   – barcode image generation, 100 req / 5 min per IP+user
 *   public-share    – public share-link access, 30 req / 10 min per IP+token
 */
export type RateLimitTier =
  | "heavy-analytics"
  | "pdf-export"
  | "bulk-export"
  | "search"
  | "barcode"
  | "barcode-image"
  | "public-share";

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
  },
  "barcode": {
    max: 20,
    windowMs: 5 * 60_000,
    message: "Barcode lookup rate limit exceeded. Try again shortly."
  },
  "barcode-image": {
    max: 100,
    windowMs: 5 * 60_000,
    message: "Barcode image rate limit exceeded. Try again shortly."
  },
  "public-share": {
    max: 30,
    windowMs: 10 * 60_000,
    message: "Share link rate limit exceeded. Try again shortly."
  }
};

/**
 * Apply a named rate-limit tier.
 *
 * By default the bucket key is `user:<userId>`, suitable for authenticated routes.
 * Pass an explicit `key` (built with `buildRateLimitKey`) for IP-based or
 * IP+discriminator limiting used by public and hybrid endpoints.
 *
 * Returns `true` and sends a 429 response when the limit is exceeded;
 * returns `false` and sets rate-limit headers otherwise.
 */
export const applyTier = async (
  request: FastifyRequest,
  reply: FastifyReply,
  tier: RateLimitTier,
  key?: string
): Promise<boolean> => {
  const config = TIER_CONFIGS[tier];
  return enforceRateLimit(request, reply, {
    scope: tier,
    key: key ?? `user:${request.auth.userId}`,
    max: config.max,
    windowMs: config.windowMs,
    message: config.message
  });
};
