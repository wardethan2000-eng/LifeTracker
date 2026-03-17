import {
  assetPartsConsumptionSchema,
  householdInventoryAnalyticsSchema,
  inventoryItemConsumptionSchema,
  inventoryReorderForecastSchema,
  inventoryTurnoverSchema,
  partCommonalitySchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import {
  classifyReorderUrgency,
  classifyVelocity,
  computeAverageConsumptionPerMonth,
  computeProjectedDate,
  computeTurnoverRate,
  groupTransactionsByMonth
} from "../../lib/inventory-analytics.js";
import { getHouseholdInventoryItem } from "../../lib/inventory.js";
import {
  toAssetPartsConsumptionResponse,
  toHouseholdInventoryAnalyticsResponse,
  toInventoryItemConsumptionResponse,
  toInventoryReorderForecastResponse,
  toInventoryTurnoverResponse,
  toPartCommonalityResponse
} from "../../lib/serializers/index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const inventoryItemParamsSchema = householdParamsSchema.extend({
  inventoryItemId: z.string().cuid()
});

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const urgencyOrder: Record<"critical" | "soon" | "planned" | "healthy", number> = {
  critical: 0,
  soon: 1,
  planned: 2,
  healthy: 3
};

const velocityOrder: Record<"stale" | "slow" | "moderate" | "fast", number> = {
  stale: 0,
  slow: 1,
  moderate: 2,
  fast: 3
};

const toMonthKey = (date: Date): string => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const getLastMonths = (months: number): string[] => {
  const now = new Date();

  return Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - index - 1), 1));
    return toMonthKey(date);
  });
};

const startOfDaysAgo = (days: number): Date => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
};

const startOfMonthsAgo = (months: number): Date => {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1));
};

const daysSince = (date: Date | null): number | null => {
  if (!date) {
    return null;
  }

  return Math.max(0, Math.floor((Date.now() - date.getTime()) / DAY_IN_MS));
};

const daysUntil = (date: Date | null): number | null => {
  if (!date) {
    return null;
  }

  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / DAY_IN_MS));
};

const normalizePartKey = (name: string, partNumber: string | null): string => {
  const normalizedName = name.trim().toLowerCase();
  const normalizedPartNumber = partNumber?.trim().toLowerCase() ?? "";
  return `${normalizedName}::${normalizedPartNumber}`;
};

export const householdInventoryAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/inventory/analytics/summary", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    await assertMembership(app.prisma, params.householdId, request.auth.userId);

    const last12MonthsStart = startOfMonthsAgo(11);
    const last30DaysStart = startOfDaysAgo(30);
    const last90DaysStart = startOfDaysAgo(90);

    const [items, last12MonthsTransactions, last30DayTransactions, last90DayTransactions, lastConsumeByItem] = await Promise.all([
      app.prisma.inventoryItem.findMany({
        where: {
          householdId: params.householdId
        },
        select: {
          id: true,
          name: true,
          category: true,
          quantityOnHand: true,
          reorderThreshold: true,
          unitCost: true
        }
      }),
      app.prisma.inventoryTransaction.findMany({
        where: {
          inventoryItem: {
            householdId: params.householdId
          },
          createdAt: {
            gte: last12MonthsStart
          }
        },
        select: {
          inventoryItemId: true,
          quantity: true,
          unitCost: true,
          createdAt: true,
          inventoryItem: {
            select: {
              name: true,
              category: true
            }
          }
        }
      }),
      app.prisma.inventoryTransaction.findMany({
        where: {
          inventoryItem: {
            householdId: params.householdId
          },
          createdAt: {
            gte: last30DaysStart
          }
        },
        select: {
          quantity: true,
          unitCost: true
        }
      }),
      app.prisma.inventoryTransaction.findMany({
        where: {
          inventoryItem: {
            householdId: params.householdId
          },
          createdAt: {
            gte: last90DaysStart
          }
        },
        select: {
          quantity: true,
          unitCost: true
        }
      }),
      app.prisma.inventoryTransaction.groupBy({
        by: ["inventoryItemId"],
        where: {
          quantity: {
            lt: 0
          },
          inventoryItem: {
            householdId: params.householdId
          }
        },
        _max: {
          createdAt: true
        }
      })
    ]);

    const spendForTransactions = (transactions: Array<{ quantity: number; unitCost: number | null }>): number => (
      transactions.reduce((sum, transaction) => (
        transaction.quantity < 0 && transaction.unitCost !== null
          ? sum + (Math.abs(transaction.quantity) * transaction.unitCost)
          : sum
      ), 0)
    );

    const consumerMap = new Map<string, {
      inventoryItemId: string;
      itemName: string;
      totalConsumed: number;
      totalSpent: number;
    }>();
    const topCostMap = new Map<string, {
      inventoryItemId: string;
      itemName: string;
      totalSpent: number;
    }>();
    const categorySpendMap = new Map<string, number>();

    for (const transaction of last12MonthsTransactions) {
      if (transaction.quantity >= 0) {
        continue;
      }

      const quantity = Math.abs(transaction.quantity);
      const cost = transaction.unitCost !== null ? quantity * transaction.unitCost : 0;
      const existingConsumer = consumerMap.get(transaction.inventoryItemId);

      if (existingConsumer) {
        existingConsumer.totalConsumed += quantity;
        existingConsumer.totalSpent += cost;
      } else {
        consumerMap.set(transaction.inventoryItemId, {
          inventoryItemId: transaction.inventoryItemId,
          itemName: transaction.inventoryItem.name,
          totalConsumed: quantity,
          totalSpent: cost
        });
      }

      const existingCost = topCostMap.get(transaction.inventoryItemId);

      if (existingCost) {
        existingCost.totalSpent += cost;
      } else {
        topCostMap.set(transaction.inventoryItemId, {
          inventoryItemId: transaction.inventoryItemId,
          itemName: transaction.inventoryItem.name,
          totalSpent: cost
        });
      }

      const categoryLabel = transaction.inventoryItem.category?.trim() || "Uncategorized";
      categorySpendMap.set(categoryLabel, (categorySpendMap.get(categoryLabel) ?? 0) + cost);
    }

    const lastConsumeMap = new Map(lastConsumeByItem.map((entry) => [entry.inventoryItemId, entry._max.createdAt]));
    const staleCutoff = startOfDaysAgo(365);
    const categoryItemMap = items.reduce<Map<string, typeof items>>((map, item) => {
      const key = item.category?.trim() || "Uncategorized";
      const existing = map.get(key);

      if (existing) {
        existing.push(item);
      } else {
        map.set(key, [item]);
      }

      return map;
    }, new Map());

    return reply.send(toHouseholdInventoryAnalyticsResponse({
      totalItems: items.length,
      totalValue: items.reduce((sum, item) => sum + (item.unitCost !== null ? item.quantityOnHand * item.unitCost : 0), 0),
      totalSpentLast30Days: spendForTransactions(last30DayTransactions),
      totalSpentLast90Days: spendForTransactions(last90DayTransactions),
      totalSpentLast12Months: spendForTransactions(last12MonthsTransactions),
      lowStockCount: items.filter((item) => item.reorderThreshold !== null && item.quantityOnHand <= item.reorderThreshold).length,
      outOfStockCount: items.filter((item) => item.quantityOnHand <= 0).length,
      staleItemCount: items.filter((item) => {
        const lastConsumeDate = lastConsumeMap.get(item.id) ?? null;
        return !lastConsumeDate || lastConsumeDate < staleCutoff;
      }).length,
      topConsumers: Array.from(consumerMap.values())
        .sort((left, right) => right.totalConsumed - left.totalConsumed)
        .slice(0, 10),
      topCostItems: Array.from(topCostMap.values())
        .sort((left, right) => right.totalSpent - left.totalSpent)
        .slice(0, 10),
      categoryBreakdown: Array.from(categoryItemMap.entries())
        .map(([category, categoryItems]) => ({
          category,
          itemCount: categoryItems.length,
          totalValue: categoryItems.reduce((sum, item) => sum + (item.unitCost !== null ? item.quantityOnHand * item.unitCost : 0), 0),
          totalSpentLast12Months: categorySpendMap.get(category) ?? 0
        }))
        .sort((left, right) => right.totalSpentLast12Months - left.totalSpentLast12Months),
      monthlySpending: groupTransactionsByMonth(last12MonthsTransactions, 12).map((entry) => ({
        month: entry.month,
        totalSpent: entry.totalCost,
        transactionCount: entry.transactionCount
      }))
    }));
  });

  app.get("/v1/households/:householdId/inventory/:inventoryItemId/analytics/consumption", async (request, reply) => {
    const params = inventoryItemParamsSchema.parse(request.params);
    await assertMembership(app.prisma, params.householdId, request.auth.userId);

    const [item, transactions] = await Promise.all([
      getHouseholdInventoryItem(app.prisma, params.householdId, params.inventoryItemId),
      app.prisma.inventoryTransaction.findMany({
        where: {
          inventoryItemId: params.inventoryItemId,
          inventoryItem: {
            householdId: params.householdId
          }
        },
        orderBy: {
          createdAt: "asc"
        },
        select: {
          quantity: true,
          unitCost: true,
          createdAt: true
        }
      })
    ]);

    if (!item) {
      return reply.code(404).send({ message: "Inventory item not found." });
    }

    const totalConsumed = transactions.reduce((sum, transaction) => transaction.quantity < 0 ? sum + Math.abs(transaction.quantity) : sum, 0);
    const totalPurchased = transactions.reduce((sum, transaction) => transaction.quantity > 0 ? sum + transaction.quantity : sum, 0);
    const totalSpent = transactions.reduce((sum, transaction) => (
      transaction.quantity < 0 && transaction.unitCost !== null
        ? sum + (Math.abs(transaction.quantity) * transaction.unitCost)
        : sum
    ), 0);
    const totalRestockSpent = transactions.reduce((sum, transaction) => (
      transaction.quantity > 0 && transaction.unitCost !== null
        ? sum + (transaction.quantity * transaction.unitCost)
        : sum
    ), 0);
    const unitCostValues = transactions
      .filter((transaction) => transaction.unitCost !== null)
      .map((transaction) => transaction.unitCost as number);
    const averageConsumptionPerMonth = computeAverageConsumptionPerMonth(transactions);
    const projectedDepletionDate = computeProjectedDate(item.quantityOnHand, averageConsumptionPerMonth ?? 0, 0);
    const projectedReorderDate = item.reorderThreshold !== null
      ? computeProjectedDate(item.quantityOnHand, averageConsumptionPerMonth ?? 0, item.reorderThreshold)
      : null;

    return reply.send(toInventoryItemConsumptionResponse({
      inventoryItemId: item.id,
      itemName: item.name,
      partNumber: item.partNumber,
      category: item.category,
      unit: item.unit,
      totalConsumed,
      totalPurchased,
      totalSpent,
      totalRestockSpent,
      transactionCount: transactions.length,
      consumeTransactionCount: transactions.filter((transaction) => transaction.quantity < 0).length,
      restockTransactionCount: transactions.filter((transaction) => transaction.quantity > 0).length,
      firstTransactionDate: transactions[0]?.createdAt.toISOString() ?? null,
      lastTransactionDate: transactions[transactions.length - 1]?.createdAt.toISOString() ?? null,
      averageConsumptionPerMonth,
      averageUnitCost: unitCostValues.length > 0
        ? unitCostValues.reduce((sum, value) => sum + value, 0) / unitCostValues.length
        : null,
      costTrend: groupTransactionsByMonth(transactions, 12).map((entry) => ({
        month: entry.month,
        averageCost: entry.averageCost,
        totalCost: entry.totalCost,
        quantity: entry.quantity
      })),
      projectedDepletionDate: projectedDepletionDate?.toISOString() ?? null,
      projectedReorderDate: projectedReorderDate?.toISOString() ?? null
    }));
  });

  app.get("/v1/households/:householdId/inventory/analytics/turnover", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    await assertMembership(app.prisma, params.householdId, request.auth.userId);

    const last12MonthsStart = startOfMonthsAgo(11);

    const [items, last12MonthsTransactions, latestTransactionByItem, latestConsumeByItem] = await Promise.all([
      app.prisma.inventoryItem.findMany({
        where: {
          householdId: params.householdId
        },
        select: {
          id: true,
          name: true,
          partNumber: true,
          category: true,
          unit: true,
          quantityOnHand: true,
          unitCost: true
        }
      }),
      app.prisma.inventoryTransaction.findMany({
        where: {
          inventoryItem: {
            householdId: params.householdId
          },
          createdAt: {
            gte: last12MonthsStart
          }
        },
        select: {
          inventoryItemId: true,
          quantity: true,
          quantityAfter: true,
          createdAt: true
        }
      }),
      app.prisma.inventoryTransaction.groupBy({
        by: ["inventoryItemId"],
        where: {
          inventoryItem: {
            householdId: params.householdId
          }
        },
        _max: {
          createdAt: true
        }
      }),
      app.prisma.inventoryTransaction.groupBy({
        by: ["inventoryItemId"],
        where: {
          inventoryItem: {
            householdId: params.householdId
          },
          quantity: {
            lt: 0
          }
        },
        _max: {
          createdAt: true
        }
      })
    ]);

    const lastTransactionMap = new Map(latestTransactionByItem.map((entry) => [entry.inventoryItemId, entry._max.createdAt]));
    const lastConsumeMap = new Map(latestConsumeByItem.map((entry) => [entry.inventoryItemId, entry._max.createdAt]));
    const last12MonthsStats = last12MonthsTransactions.reduce<Map<string, {
      consumed: number;
      quantitySnapshots: number[];
    }>>((map, transaction) => {
      const existing = map.get(transaction.inventoryItemId) ?? {
        consumed: 0,
        quantitySnapshots: []
      };

      existing.quantitySnapshots.push(transaction.quantityAfter);

      if (transaction.quantity < 0) {
        existing.consumed += Math.abs(transaction.quantity);
      }

      map.set(transaction.inventoryItemId, existing);
      return map;
    }, new Map());

    const rows = items.map((item) => {
      const stats = last12MonthsStats.get(item.id);
      const averageOnHand = stats && stats.quantitySnapshots.length > 0
        ? ([...stats.quantitySnapshots, item.quantityOnHand].reduce((sum, value) => sum + value, 0) / (stats.quantitySnapshots.length + 1))
        : item.quantityOnHand;
      const daysSinceLastTransaction = daysSince(lastTransactionMap.get(item.id) ?? null);
      const daysSinceLastConsumption = daysSince(lastConsumeMap.get(item.id) ?? null);
      const turnoverRate = stats && stats.consumed > 0
        ? computeTurnoverRate(stats.consumed, averageOnHand)
        : null;
      const velocityCategory = classifyVelocity(daysSinceLastConsumption);

      return {
        inventoryItemId: item.id,
        itemName: item.name,
        partNumber: item.partNumber,
        category: item.category,
        unit: item.unit,
        quantityOnHand: item.quantityOnHand,
        unitCost: item.unitCost,
        totalValue: item.unitCost !== null ? item.quantityOnHand * item.unitCost : null,
        daysSinceLastTransaction,
        daysSinceLastConsumption,
        turnoverRate,
        velocityCategory
      };
    });

    return reply.send(rows.sort((left, right) => {
      const byVelocity = velocityOrder[left.velocityCategory] - velocityOrder[right.velocityCategory];

      if (byVelocity !== 0) {
        return byVelocity;
      }

      return (right.daysSinceLastConsumption ?? Number.MAX_SAFE_INTEGER) - (left.daysSinceLastConsumption ?? Number.MAX_SAFE_INTEGER);
    }).map(toInventoryTurnoverResponse));
  });

  app.get("/v1/households/:householdId/inventory/analytics/reorder-forecast", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    await assertMembership(app.prisma, params.householdId, request.auth.userId);

    const last12MonthsStart = startOfMonthsAgo(11);
    const items = await app.prisma.inventoryItem.findMany({
      where: {
        householdId: params.householdId,
        itemType: "consumable",
        reorderThreshold: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        partNumber: true,
        quantityOnHand: true,
        reorderThreshold: true,
        reorderQuantity: true,
        unitCost: true,
        preferredSupplier: true,
        supplierUrl: true
      }
    });

    const transactions = items.length === 0
      ? []
      : await app.prisma.inventoryTransaction.findMany({
          where: {
            inventoryItemId: {
              in: items.map((item) => item.id)
            },
            quantity: {
              lt: 0
            },
            createdAt: {
              gte: last12MonthsStart
            }
          },
          select: {
            inventoryItemId: true,
            quantity: true,
            createdAt: true
          },
          orderBy: {
            createdAt: "asc"
          }
        });

    const transactionMap = transactions.reduce<Map<string, Array<{ quantity: number; createdAt: Date }>>>((map, transaction) => {
      const existing = map.get(transaction.inventoryItemId);

      if (existing) {
        existing.push(transaction);
      } else {
        map.set(transaction.inventoryItemId, [transaction]);
      }

      return map;
    }, new Map());

    const result = items.map((item) => {
      const averageConsumptionPerMonth = computeAverageConsumptionPerMonth(transactionMap.get(item.id) ?? []) ?? 0;
      const projectedReorderDate = computeProjectedDate(item.quantityOnHand, averageConsumptionPerMonth, item.reorderThreshold ?? 0);
      const projectedDepletionDate = computeProjectedDate(item.quantityOnHand, averageConsumptionPerMonth, 0);
      const daysUntilReorder = daysUntil(projectedReorderDate);
      const daysUntilDepletion = daysUntil(projectedDepletionDate);
      const urgency = classifyReorderUrgency(daysUntilReorder, item.quantityOnHand, item.reorderThreshold);

      return {
        inventoryItemId: item.id,
        itemName: item.name,
        partNumber: item.partNumber,
        quantityOnHand: item.quantityOnHand,
        reorderThreshold: item.reorderThreshold,
        reorderQuantity: item.reorderQuantity,
        unitCost: item.unitCost,
        preferredSupplier: item.preferredSupplier,
        supplierUrl: item.supplierUrl,
        averageConsumptionPerMonth,
        projectedReorderDate: projectedReorderDate?.toISOString() ?? null,
        projectedDepletionDate: projectedDepletionDate?.toISOString() ?? null,
        daysUntilReorder,
        daysUntilDepletion,
        estimatedReorderCost: item.reorderQuantity !== null && item.unitCost !== null
          ? item.reorderQuantity * item.unitCost
          : null,
        urgency
      };
    });

    return reply.send(result.sort((left, right) => {
      const byUrgency = urgencyOrder[left.urgency] - urgencyOrder[right.urgency];

      if (byUrgency !== 0) {
        return byUrgency;
      }

      return (left.daysUntilReorder ?? Number.MAX_SAFE_INTEGER) - (right.daysUntilReorder ?? Number.MAX_SAFE_INTEGER);
    }).map(toInventoryReorderForecastResponse));
  });

  app.get("/v1/households/:householdId/inventory/analytics/asset-consumption", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    await assertMembership(app.prisma, params.householdId, request.auth.userId);

    const parts = await app.prisma.maintenanceLogPart.findMany({
      where: {
        log: {
          asset: {
            householdId: params.householdId
          }
        }
      },
      select: {
        name: true,
        partNumber: true,
        quantity: true,
        unitCost: true,
        log: {
          select: {
            completedAt: true,
            asset: {
              select: {
                id: true,
                name: true,
                category: true
              }
            }
          }
        }
      },
      orderBy: {
        log: {
          completedAt: "asc"
        }
      }
    });

    const monthKeys = getLastMonths(12);
    const assetMap = parts.reduce<Map<string, {
      assetId: string;
      assetName: string;
      assetCategory: string;
      totalPartsUsedKeys: Set<string>;
      totalPartsCost: number;
      totalPartsQuantity: number;
      topPartsMap: Map<string, {
        partName: string;
        partNumber: string | null;
        totalQuantity: number;
        totalCost: number;
        occurrences: number;
        dates: Date[];
      }>;
      monthlyPartsCostMap: Map<string, { month: string; totalCost: number; partCount: number }>;
    }>>((map, part) => {
      const asset = part.log.asset;
      const existing = map.get(asset.id) ?? {
        assetId: asset.id,
        assetName: asset.name,
        assetCategory: asset.category,
        totalPartsUsedKeys: new Set<string>(),
        totalPartsCost: 0,
        totalPartsQuantity: 0,
        topPartsMap: new Map(),
        monthlyPartsCostMap: monthKeys.reduce<Map<string, { month: string; totalCost: number; partCount: number }>>((monthMap, month) => {
          monthMap.set(month, {
            month,
            totalCost: 0,
            partCount: 0
          });
          return monthMap;
        }, new Map())
      };
      const partKey = normalizePartKey(part.name, part.partNumber);
      const partCost = part.unitCost !== null ? part.quantity * part.unitCost : 0;
      const existingTopPart = existing.topPartsMap.get(partKey) ?? {
        partName: part.name,
        partNumber: part.partNumber,
        totalQuantity: 0,
        totalCost: 0,
        occurrences: 0,
        dates: []
      };

      existing.totalPartsUsedKeys.add(part.name.trim().toLowerCase());
      existing.totalPartsCost += partCost;
      existing.totalPartsQuantity += part.quantity;

      existingTopPart.totalQuantity += part.quantity;
      existingTopPart.totalCost += partCost;
      existingTopPart.occurrences += 1;
      existingTopPart.dates.push(part.log.completedAt);
      existing.topPartsMap.set(partKey, existingTopPart);

      const monthBucket = existing.monthlyPartsCostMap.get(toMonthKey(part.log.completedAt));

      if (monthBucket) {
        monthBucket.totalCost += partCost;
        monthBucket.partCount += 1;
      }

      map.set(asset.id, existing);
      return map;
    }, new Map());

    const result = Array.from(assetMap.values()).map((asset) => ({
      assetId: asset.assetId,
      assetName: asset.assetName,
      assetCategory: asset.assetCategory,
      totalPartsUsed: asset.totalPartsUsedKeys.size,
      totalPartsCost: asset.totalPartsCost,
      totalPartsQuantity: asset.totalPartsQuantity,
      topParts: Array.from(asset.topPartsMap.values())
        .map((part) => {
          const sortedDates = part.dates.slice().sort((left, right) => left.getTime() - right.getTime());
          const intervals = sortedDates.slice(1).map((date, index) => (date.getTime() - sortedDates[index]!.getTime()) / DAY_IN_MS);

          return {
            partName: part.partName,
            partNumber: part.partNumber,
            totalQuantity: part.totalQuantity,
            totalCost: part.totalCost,
            occurrences: part.occurrences,
            averageInterval: intervals.length > 0
              ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
              : null
          };
        })
        .sort((left, right) => right.occurrences - left.occurrences)
        .slice(0, 10),
      monthlyPartsCost: monthKeys.map((month) => asset.monthlyPartsCostMap.get(month) ?? {
        month,
        totalCost: 0,
        partCount: 0
      })
    }));

    return reply.send(result
      .sort((left, right) => right.totalPartsCost - left.totalPartsCost)
      .map(toAssetPartsConsumptionResponse));
  });

  app.get("/v1/households/:householdId/inventory/analytics/part-commonality", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    await assertMembership(app.prisma, params.householdId, request.auth.userId);

    const parts = await app.prisma.maintenanceLogPart.findMany({
      where: {
        log: {
          asset: {
            householdId: params.householdId
          }
        }
      },
      select: {
        name: true,
        partNumber: true,
        quantity: true,
        unitCost: true,
        log: {
          select: {
            completedAt: true,
            asset: {
              select: {
                id: true,
                name: true,
                category: true
              }
            }
          }
        }
      }
    });

    const partMap = parts.reduce<Map<string, {
      partName: string;
      partNumber: string | null;
      assets: Map<string, {
        assetId: string;
        assetName: string;
        assetCategory: string;
        timesUsed: number;
        totalQuantity: number;
        lastUsedDate: Date;
      }>;
      totalQuantityAcrossAssets: number;
      totalCostAcrossAssets: number;
    }>>((map, part) => {
      const key = normalizePartKey(part.name, part.partNumber);
      const existing = map.get(key) ?? {
        partName: part.name.trim(),
        partNumber: part.partNumber?.trim() || null,
        assets: new Map(),
        totalQuantityAcrossAssets: 0,
        totalCostAcrossAssets: 0
      };
      const asset = part.log.asset;
      const existingAsset = existing.assets.get(asset.id) ?? {
        assetId: asset.id,
        assetName: asset.name,
        assetCategory: asset.category,
        timesUsed: 0,
        totalQuantity: 0,
        lastUsedDate: part.log.completedAt
      };

      existingAsset.timesUsed += 1;
      existingAsset.totalQuantity += part.quantity;
      if (part.log.completedAt > existingAsset.lastUsedDate) {
        existingAsset.lastUsedDate = part.log.completedAt;
      }

      existing.totalQuantityAcrossAssets += part.quantity;
      existing.totalCostAcrossAssets += part.unitCost !== null ? part.quantity * part.unitCost : 0;
      existing.assets.set(asset.id, existingAsset);
      map.set(key, existing);
      return map;
    }, new Map());

    const result = Array.from(partMap.values())
      .map((part) => ({
        partName: part.partName,
        partNumber: part.partNumber,
        assets: Array.from(part.assets.values())
          .sort((left, right) => right.timesUsed - left.timesUsed)
          .map((asset) => ({
            assetId: asset.assetId,
            assetName: asset.assetName,
            assetCategory: asset.assetCategory,
            timesUsed: asset.timesUsed,
            totalQuantity: asset.totalQuantity,
            lastUsedDate: asset.lastUsedDate.toISOString()
          })),
        totalAssets: part.assets.size,
        totalQuantityAcrossAssets: part.totalQuantityAcrossAssets,
        totalCostAcrossAssets: part.totalCostAcrossAssets
      }))
      .filter((part) => part.totalAssets > 1)
      .sort((left, right) => {
        if (right.totalAssets !== left.totalAssets) {
          return right.totalAssets - left.totalAssets;
        }

        return right.totalQuantityAcrossAssets - left.totalQuantityAcrossAssets;
      });

    return reply.send(result.map(toPartCommonalityResponse));
  });
};