import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import { startOfUtcMonth, addUtcMonths } from "@lifekeeper/utils";
import { assertMembership } from "../../lib/asset-access.js";
import { computeScheduleCompliance } from "../../lib/schedule-compliance.js";
import { toScheduleComplianceDashboardResponse } from "../../lib/serializers/index.js";
import { forbidden } from "../../lib/errors.js";
import { householdParamsSchema } from "../../lib/schemas.js";

const scheduleComplianceQuerySchema = z.object({
  periodMonths: z.coerce.number().int().min(1).max(60).default(12)
});

export const scheduleComplianceRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/schedule-compliance", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = scheduleComplianceQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const household = await app.prisma.household.findUnique({
      where: { id: params.householdId },
      select: { timezone: true }
    });
    const householdTimezone = household?.timezone ?? "UTC";

    const periodEnd = new Date();
    const periodStart = startOfUtcMonth(addUtcMonths(periodEnd, -(query.periodMonths - 1)));

    const [logs, schedules, members] = await Promise.all([
      app.prisma.maintenanceLog.findMany({
        where: {
          scheduleId: { not: null },
          asset: { householdId: params.householdId },
          completedAt: { lte: periodEnd }
        },
        select: {
          id: true,
          completedAt: true,
          scheduleId: true,
          assetId: true,
          completedById: true,
          usageValue: true
        },
        orderBy: [
          { scheduleId: "asc" },
          { completedAt: "asc" },
          { createdAt: "asc" }
        ]
      }),
      app.prisma.maintenanceSchedule.findMany({
        where: {
          asset: { householdId: params.householdId }
        },
        select: {
          id: true,
          assetId: true,
          name: true,
          triggerType: true,
          triggerConfig: true,
          isActive: true,
          nextDueAt: true,
          nextDueMetricValue: true,
          lastCompletedAt: true,
          createdAt: true,
          asset: {
            select: {
              name: true,
              category: true
            }
          },
          metric: {
            select: {
              currentValue: true
            }
          }
        },
        orderBy: [
          { asset: { name: "asc" } },
          { name: "asc" }
        ]
      }),
      app.prisma.householdMember.findMany({
        where: { householdId: params.householdId },
        select: {
          user: {
            select: {
              id: true,
              displayName: true
            }
          }
        }
      })
    ]);

    return toScheduleComplianceDashboardResponse(computeScheduleCompliance(
      logs,
      schedules,
      members.map((member) => member.user),
      { periodStart, periodEnd },
      householdTimezone
    ));
  });
};

export default scheduleComplianceRoutes;