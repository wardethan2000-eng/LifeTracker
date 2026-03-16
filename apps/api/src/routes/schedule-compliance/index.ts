import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import { assertMembership } from "../../lib/asset-access.js";
import { computeScheduleCompliance } from "../../lib/schedule-compliance.js";
import { toScheduleComplianceDashboardResponse } from "../../lib/serializers/index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const scheduleComplianceQuerySchema = z.object({
  periodMonths: z.coerce.number().int().min(1).max(60).default(12)
});

const startOfUtcMonth = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const addUtcMonths = (date: Date, months: number): Date => new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth() + months,
  date.getUTCDate(),
  date.getUTCHours(),
  date.getUTCMinutes(),
  date.getUTCSeconds(),
  date.getUTCMilliseconds()
));

export const scheduleComplianceRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/schedule-compliance", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = scheduleComplianceQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

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
      { periodStart, periodEnd }
    ));
  });
};

export default scheduleComplianceRoutes;