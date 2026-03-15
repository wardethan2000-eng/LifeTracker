import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../lib/asset-access.js";
import { buildAssetDetail, buildHouseholdDashboard, DashboardNotFoundError, listHouseholdDueWork } from "../lib/dashboard.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const assetParamsSchema = z.object({
  assetId: z.string().cuid()
});

const dueWorkQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(["all", "due", "overdue"]).default("all")
});

const dashboardQuerySchema = z.object({
  dueWorkLimit: z.coerce.number().int().min(1).max(25).default(8),
  notificationLimit: z.coerce.number().int().min(1).max(25).default(8)
});

const assetDetailQuerySchema = z.object({
  logLimit: z.coerce.number().int().min(1).max(50).default(10)
});

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/due-work", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = dueWorkQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    return await listHouseholdDueWork(app.prisma, params.householdId, request.auth.userId, query);
  });

  app.get("/v1/households/:householdId/dashboard", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = dashboardQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    try {
      return await buildHouseholdDashboard(app.prisma, params.householdId, request.auth.userId, query);
    } catch (error) {
      if (error instanceof DashboardNotFoundError) {
        return reply.code(404).send({ message: "Household not found." });
      }

      throw error;
    }
  });

  app.get("/v1/assets/:assetId/detail", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const query = assetDetailQuerySchema.parse(request.query);
    const detail = await buildAssetDetail(app.prisma, params.assetId, request.auth.userId, query.logLimit);

    if (!detail) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    return detail;
  });
};