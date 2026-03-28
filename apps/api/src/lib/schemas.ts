/**
 * Shared Zod parameter and query schemas for route handlers.
 * Import these instead of redefining them in each route file.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Route parameter schemas
// ---------------------------------------------------------------------------

export const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

/** Standalone asset param — no householdId. */
export const assetParamsSchema = z.object({
  assetId: z.string().cuid()
});

/** Project param — includes householdId. */
export const projectParamsSchema = householdParamsSchema.extend({
  projectId: z.string().cuid()
});

/** Hobby param — includes householdId. */
export const hobbyParamsSchema = householdParamsSchema.extend({
  hobbyId: z.string().cuid()
});

/** Idea param — includes householdId. */
export const ideaParamsSchema = householdParamsSchema.extend({
  ideaId: z.string().cuid()
});

// ---------------------------------------------------------------------------
// Shared query schemas
// ---------------------------------------------------------------------------

/**
 * Base cursor-pagination query fields — limit optional up to 100, cursor an
 * opaque string. Routes that need different defaults or a `.cuid()` cursor
 * should extend this schema and override the relevant fields.
 */
export const cursorPaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional()
});

/** QR code generation query — format (png | svg) and pixel size. */
export const qrCodeQuerySchema = z.object({
  format: z.enum(["png", "svg"]).default("svg"),
  size: z.coerce.number().int().min(100).max(1000).default(300)
});
