import type { FastifyPluginAsync } from "fastify";
import { getAccessibleAsset } from "../../lib/asset-access.js";
import { notFound } from "../../lib/errors.js";
import { assetParamsSchema } from "../../lib/schemas.js";
import { computeLogTotalCost } from "@aegis/utils";

export const tcoRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/assets/:assetId/cost-analytics/tco", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    // 1. Purchase price from JSON purchaseDetails
    const purchaseDetailsRaw = asset.purchaseDetails as Record<string, unknown> | null;
    const purchasePrice = typeof purchaseDetailsRaw?.price === "number"
      ? purchaseDetailsRaw.price
      : 0;
    const acquiredAt = asset.purchaseDate ?? asset.createdAt;
    const now = new Date();
    const monthsOwned = Math.max(
      1,
      (now.getFullYear() - acquiredAt.getFullYear()) * 12 +
        (now.getMonth() - acquiredAt.getMonth())
    );

    // 2. Maintenance logs — costs, labor, parts, failure modes
    const logs = await app.prisma.maintenanceLog.findMany({
      where: { assetId: asset.id, deletedAt: null },
      include: {
        parts: { select: { quantity: true, unitCost: true, name: true } }
      },
      orderBy: { completedAt: "asc" }
    });

    let maintenanceCost = 0;
    let partsCost = 0;
    let laborCost = 0;

    type TimelineEntry = {
      date: string;
      cumulativeCost: number;
      source: string;
      label: string;
      amount: number;
    };

    const timeline: TimelineEntry[] = [];
    let cumulative = purchasePrice;

    if (purchasePrice > 0) {
      timeline.push({
        date: acquiredAt.toISOString(),
        cumulativeCost: cumulative,
        source: "purchase",
        label: "Purchase price",
        amount: purchasePrice
      });
    }

    // Failure mode aggregation
    const failureMap = new Map<
      string,
      { count: number; totalCost: number; lastOccurrence: Date }
    >();

    for (const log of logs) {
      const computed = computeLogTotalCost({
        cost: log.cost ?? null,
        laborHours: log.laborHours ?? null,
        laborRate: log.laborRate ?? null,
        parts: log.parts.map((p) => ({
          quantity: p.quantity,
          unitCost: p.unitCost ?? null
        }))
      });

      const logLabor =
        (log.laborHours ?? 0) * (log.laborRate ?? 0);
      const logParts = log.parts.reduce(
        (sum, p) => sum + p.quantity * (p.unitCost ?? 0),
        0
      );
      const logDirect = log.cost ?? 0;

      maintenanceCost += logDirect;
      partsCost += logParts;
      laborCost += logLabor;

      const logTotal = computed.totalCost;
      if (logTotal > 0) {
        cumulative += logTotal;
        timeline.push({
          date: log.completedAt.toISOString(),
          cumulativeCost: cumulative,
          source: "maintenance",
          label: log.title,
          amount: logTotal
        });
      }

      // Failure tracking
      if (log.failureMode) {
        const existing = failureMap.get(log.failureMode);
        if (existing) {
          existing.count += 1;
          existing.totalCost += logTotal;
          if (log.completedAt > existing.lastOccurrence) {
            existing.lastOccurrence = log.completedAt;
          }
        } else {
          failureMap.set(log.failureMode, {
            count: 1,
            totalCost: logTotal,
            lastOccurrence: log.completedAt
          });
        }
      }
    }

    // 3. Project expenses linked to this asset
    const projectAssets = await app.prisma.projectAsset.findMany({
      where: { assetId: asset.id },
      select: {
        project: {
          select: {
            id: true,
            name: true,
            budget: true,
            actualCost: true,
            createdAt: true
          }
        }
      }
    });

    let projectExpenses = 0;
    for (const pa of projectAssets) {
      const cost = pa.project.actualCost ?? 0;
      if (cost > 0) {
        projectExpenses += cost;
        cumulative += cost;
        timeline.push({
          date: pa.project.createdAt.toISOString(),
          cumulativeCost: cumulative,
          source: "project",
          label: pa.project.name,
          amount: cost
        });
      }
    }

    const totalCost =
      purchasePrice + maintenanceCost + partsCost + laborCost + projectExpenses;
    const costPerMonth = totalCost / monthsOwned;
    const costPerYear = costPerMonth * 12;

    // Sort timeline chronologically
    timeline.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Recompute cumulative after sorting
    let running = 0;
    for (const entry of timeline) {
      running += entry.amount;
      entry.cumulativeCost = running;
    }

    const failureSummary = Array.from(failureMap.entries()).map(
      ([failureMode, data]) => ({
        failureMode,
        count: data.count,
        totalCost: data.totalCost,
        lastOccurrence: data.lastOccurrence.toISOString()
      })
    );

    return {
      assetId: asset.id,
      breakdown: {
        purchasePrice,
        maintenanceCost,
        partsCost,
        laborCost,
        projectExpenses,
        totalCost,
        monthsOwned,
        costPerMonth: Math.round(costPerMonth * 100) / 100,
        costPerYear: Math.round(costPerYear * 100) / 100
      },
      timeline,
      failureSummary
    };
  });
};
