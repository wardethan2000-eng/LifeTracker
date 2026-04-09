/**
 * Shared test helpers for Aegis API tests.
 *
 * Usage:
 *   import { buildApp, householdId, userId, mockPrismaBase } from "./helpers.js";
 *
 *   const app = await buildApp(myRoutePlugin, { household: { ...mockPrismaBase.household, ... } });
 *   const res = await app.inject({ method: "GET", url: "/v1/..." });
 */

import Fastify, { type FastifyInstance } from "fastify";
import type { FastifyPluginAsync } from "fastify";
import { errorHandlerPlugin } from "../src/plugins/error-handler.js";

// ─── Canonical test IDs ────────────────────────────────────────────────────────
// Kept consistent across all test files so logs, foreign keys, etc. match up.
export const householdId = "clkeeperhouse000000000001";
export const userId = "clkeeperuser0000000000001";
export const secondUserId = "clkeeperuser0000000000002";

// ─── Standard auth hook ───────────────────────────────────────────────────────
/**
 * Adds a dev-bypass auth hook that injects `userId` into every request.
 * Pass `overrideUserId` to test a different acting user.
 */
export function addDevAuth(app: FastifyInstance, overrideUserId = userId) {
  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = {
      userId: overrideUserId,
      clerkUserId: null,
      source: "dev-bypass",
    };
  });
}

// ─── Minimal household membership mock ───────────────────────────────────────
/**
 * A minimal `prisma.householdMember.findUnique` mock that grants membership.
 * Covers the `requireHouseholdMembership` / `assertMembership` path used in
 * most routes.
 */
export const householdMemberMock = {
  findUnique: async () => ({ householdId, userId, role: "owner" as const }),
};

// ─── App builder ─────────────────────────────────────────────────────────────
/**
 * Creates a Fastify instance pre-decorated with `prisma` and auth, then
 * registers the given plugin.
 *
 * @param plugin    The route plugin to test
 * @param prisma    Partial Prisma client mock (spreaded onto the decorator)
 * @param actingUserId  Optional override for the auth user ID
 */
export async function buildApp(
  plugin: FastifyPluginAsync,
  prisma: Record<string, unknown>,
  actingUserId = userId,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorate("prisma", prisma as never);
  addDevAuth(app, actingUserId);
  await app.register(errorHandlerPlugin);
  await app.register(plugin);
  return app;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
export const fixedDate = new Date("2026-01-15T00:00:00.000Z");
export const fixedDateStr = fixedDate.toISOString();
