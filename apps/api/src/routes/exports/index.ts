import type { Asset, PrismaClient } from "@prisma/client";
import {
  conditionEntrySchema,
  csvExportDatasetSchema,
  householdDataExportSchema,
  type AssetTimelineItem
} from "@lifekeeper/types";
import {
  aggregateCostsByPeriod,
  computeLogTotalCost
} from "@lifekeeper/utils";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset, requireHouseholdMembership } from "../../lib/asset-access.js";
import { generateAssetHistoryPdf } from "../../lib/pdf-report.js";
import { toTimelineItem } from "../../lib/serializers/index.js";

const assetParamsSchema = z.object({
  assetId: z.string().cuid()
});

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const dateRangeQuerySchema = z.object({
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional()
});

const assetCsvQuerySchema = dateRangeQuerySchema.extend({
  dataset: csvExportDatasetSchema
});

const householdCsvDatasetSchema = z.enum([
  "cost-dashboard",
  "activity-log",
  "schedules-all"
]);

const householdCsvQuerySchema = dateRangeQuerySchema.extend({
  dataset: householdCsvDatasetSchema
});

type TimelineAsset = Pick<Asset, "id" | "householdId" | "conditionHistory">;

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

const sanitizeFileSegment = (value: string): string => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 80) || "asset";

const formatTimelineSourceLabel = (sourceType: AssetTimelineItem["sourceType"]): string => {
  switch (sourceType) {
    case "maintenance_log":
      return "Maintenance Log";
    case "timeline_entry":
      return "Manual Entry";
    case "project_event":
      return "Project Event";
    case "inventory_transaction":
      return "Inventory Transaction";
    case "schedule_change":
      return "Schedule Change";
    case "comment":
      return "Comment";
    case "condition_assessment":
      return "Condition Assessment";
    case "usage_reading":
      return "Usage Reading";
    default:
      return "Activity";
  }
};

const formatCsvDate = (value: string | Date): string => new Date(value).toISOString();

const formatCurrency = (value: number | null | undefined): string => typeof value === "number"
  ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
  : "";

const matchesDateRange = (isoDate: string, since?: string, until?: string): boolean => {
  const value = new Date(isoDate).getTime();

  if (since && value < new Date(since).getTime()) {
    return false;
  }

  if (until && value > new Date(until).getTime()) {
    return false;
  }

  return true;
};

const escapeCsvCell = (value: string): string => /[",\n]/.test(value)
  ? `"${value.replace(/"/g, '""')}"`
  : value;

export const buildCsv = (headers: string[], rows: string[][]): string => [
  headers.map(escapeCsvCell).join(","),
  ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
].join("\n");

const extractEntityName = (metadata: Record<string, unknown>, fallback: string): string => {
  const candidates = [
    metadata.name,
    metadata.title,
    metadata.taskTitle,
    metadata.phaseName,
    metadata.assetName,
    metadata.label
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return fallback;
};

export const buildAssetTimeline = async (
  prisma: PrismaClient,
  asset: TimelineAsset,
  range: { since?: string | undefined; until?: string | undefined }
): Promise<AssetTimelineItem[]> => {
  const [taskIds, phaseIds] = await Promise.all([
    prisma.projectTask.findMany({
      where: {
        deletedAt: null,
        project: {
          deletedAt: null,
          assets: {
            some: {
              assetId: asset.id
            }
          }
        }
      },
      select: { id: true }
    }),
    prisma.projectPhase.findMany({
      where: {
        deletedAt: null,
        project: {
          deletedAt: null,
          assets: {
            some: {
              assetId: asset.id
            }
          }
        }
      },
      select: { id: true }
    })
  ]);

  const projectTaskIds = taskIds.map((task) => task.id);
  const projectPhaseIds = phaseIds.map((phase) => phase.id);

  const [maintenanceLogs, timelineEntries, projectEvents, scheduleActivities, comments, usageReadings, inventoryTransactions] = await Promise.all([
    prisma.maintenanceLog.findMany({
      where: {
        assetId: asset.id,
        ...(range.since || range.until
          ? {
              completedAt: {
                ...(range.since ? { gte: new Date(range.since) } : {}),
                ...(range.until ? { lte: new Date(range.until) } : {})
              }
            }
          : {})
      },
      include: {
        parts: true,
        completedBy: {
          select: {
            id: true,
            displayName: true
          }
        }
      }
    }),
    prisma.assetTimelineEntry.findMany({
      where: {
        assetId: asset.id,
        ...(range.since || range.until
          ? {
              entryDate: {
                ...(range.since ? { gte: new Date(range.since) } : {}),
                ...(range.until ? { lte: new Date(range.until) } : {})
              }
            }
          : {})
      },
      include: {
        createdBy: {
          select: {
            id: true,
            displayName: true
          }
        }
      }
    }),
    projectTaskIds.length === 0 && projectPhaseIds.length === 0
      ? Promise.resolve([])
      : prisma.activityLog.findMany({
          where: {
            householdId: asset.householdId,
            ...(range.since || range.until
              ? {
                  createdAt: {
                    ...(range.since ? { gte: new Date(range.since) } : {}),
                    ...(range.until ? { lte: new Date(range.until) } : {})
                  }
                }
              : {}),
            OR: [
              ...(projectTaskIds.length > 0 ? [{ entityType: "project_task", entityId: { in: projectTaskIds } }] : []),
              ...(projectPhaseIds.length > 0 ? [{ entityType: "project_phase", entityId: { in: projectPhaseIds } }] : [])
            ]
          },
          include: {
            user: {
              select: {
                id: true,
                displayName: true
              }
            }
          }
        }),
    prisma.activityLog.findMany({
      where: {
        householdId: asset.householdId,
        entityType: "schedule",
        ...(range.since || range.until
          ? {
              createdAt: {
                ...(range.since ? { gte: new Date(range.since) } : {}),
                ...(range.until ? { lte: new Date(range.until) } : {})
              }
            }
          : {})
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true
          }
        }
      }
    }),
    prisma.comment.findMany({
      where: {
        assetId: asset.id,
        ...(range.since || range.until
          ? {
              createdAt: {
                ...(range.since ? { gte: new Date(range.since) } : {}),
                ...(range.until ? { lte: new Date(range.until) } : {})
              }
            }
          : {})
      },
      include: {
        author: {
          select: {
            id: true,
            displayName: true
          }
        }
      }
    }),
    prisma.usageMetricEntry.findMany({
      where: {
        metric: {
          assetId: asset.id
        },
        ...(range.since || range.until
          ? {
              recordedAt: {
                ...(range.since ? { gte: new Date(range.since) } : {}),
                ...(range.until ? { lte: new Date(range.until) } : {})
              }
            }
          : {})
      },
      include: {
        metric: {
          select: {
            assetId: true,
            name: true,
            unit: true
          }
        }
      }
    }),
    prisma.inventoryTransaction.findMany({
      where: {
        inventoryItem: {
          assetLinks: {
            some: {
              assetId: asset.id
            }
          }
        },
        ...(range.since || range.until
          ? {
              createdAt: {
                ...(range.since ? { gte: new Date(range.since) } : {}),
                ...(range.until ? { lte: new Date(range.until) } : {})
              }
            }
          : {})
      },
      include: {
        inventoryItem: {
          select: {
            name: true,
            partNumber: true
          }
        },
        user: {
          select: {
            id: true,
            displayName: true
          }
        }
      }
    })
  ]);

  const conditionHistory = conditionEntrySchema.array().safeParse(
    Array.isArray(asset.conditionHistory) ? asset.conditionHistory : []
  );

  const normalizedItems = [
    ...maintenanceLogs.map((log) => {
      const totalPartsCost = log.parts.reduce((sum, part) => sum + part.quantity * (part.unitCost ?? 0), 0);
      const totalLaborCost = typeof log.laborHours === "number" && typeof log.laborRate === "number"
        ? log.laborHours * log.laborRate
        : null;

      return toTimelineItem("maintenance_log", {
        ...log,
        totalPartsCost,
        totalLaborCost
      }, {
        id: log.completedBy.id,
        displayName: log.completedBy.displayName
      });
    }),
    ...timelineEntries.map((entry) => toTimelineItem("timeline_entry", entry, {
      id: entry.createdBy.id,
      displayName: entry.createdBy.displayName
    })),
    ...projectEvents.map((activity) => toTimelineItem("project_event", {
      ...activity,
      assetId: asset.id
    }, {
      id: activity.user.id,
      displayName: activity.user.displayName
    })),
    ...scheduleActivities
      .filter((activity) => asRecord(activity.metadata).assetId === asset.id)
      .map((activity) => toTimelineItem("schedule_change", {
        ...activity,
        assetId: asset.id
      }, {
        id: activity.user.id,
        displayName: activity.user.displayName
      })),
    ...comments.map((comment) => toTimelineItem("comment", comment, {
      id: comment.author.id,
      displayName: comment.author.displayName
    })),
    ...(conditionHistory.success
      ? conditionHistory.data
          .filter((entry) => matchesDateRange(entry.assessedAt, range.since, range.until))
          .map((entry) => toTimelineItem("condition_assessment", {
            assetId: asset.id,
            ...entry
          }))
      : []),
    ...usageReadings.map((reading) => toTimelineItem("usage_reading", reading)),
    ...inventoryTransactions.map((transaction) => toTimelineItem("inventory_transaction", {
      id: transaction.id,
      assetId: asset.id,
      type: transaction.type,
      quantity: transaction.quantity,
      unitCost: transaction.unitCost,
      createdAt: transaction.createdAt,
      notes: transaction.notes,
      userId: transaction.userId,
      inventoryItem: {
        name: transaction.inventoryItem.name,
        partNumber: transaction.inventoryItem.partNumber
      }
    }, {
      id: transaction.user.id,
      displayName: transaction.user.displayName
    }))
  ].sort((left, right) => {
    const eventDelta = new Date(right.eventDate).getTime() - new Date(left.eventDate).getTime();

    if (eventDelta !== 0) {
      return eventDelta;
    }

    const createdDelta = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

    if (createdDelta !== 0) {
      return createdDelta;
    }

    return right.id.localeCompare(left.id);
  });

  return normalizedItems;
};

export const buildAssetCostSummary = async (
  prisma: PrismaClient,
  assetId: string,
  range: { since?: string | undefined; until?: string | undefined }
) => {
  const logs = await prisma.maintenanceLog.findMany({
    where: {
      assetId,
      ...(range.since || range.until
        ? {
            completedAt: {
              ...(range.since ? { gte: new Date(range.since) } : {}),
              ...(range.until ? { lte: new Date(range.until) } : {})
            }
          }
        : {})
    },
    include: {
      parts: {
        select: {
          quantity: true,
          unitCost: true
        }
      },
      schedule: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: { completedAt: "asc" }
  });

  const costEntries = logs.map((log) => ({
    log,
    totalCost: computeLogTotalCost(log).totalCost
  }));
  const lifetimeCost = costEntries.reduce((sum, entry) => sum + entry.totalCost, 0);
  const currentYear = new Date().getUTCFullYear();
  const yearToDateCost = costEntries
    .filter((entry) => entry.log.completedAt.getUTCFullYear() === currentYear)
    .reduce((sum, entry) => sum + entry.totalCost, 0);
  const yearly = aggregateCostsByPeriod(costEntries.map((entry) => ({
    totalCost: entry.totalCost,
    completedAt: entry.log.completedAt
  })), "year");
  const monthly = aggregateCostsByPeriod(costEntries.map((entry) => ({
    totalCost: entry.totalCost,
    completedAt: entry.log.completedAt
  })), "month");

  return {
    lifetimeCost,
    yearToDateCost,
    rolling12MonthAverage: monthly.rolling12MonthAverage,
    logCount: costEntries.length,
    costByYear: yearly.periods.map((entry) => ({
      year: entry.period,
      totalCost: entry.totalCost,
      logCount: entry.logCount
    }))
  };
};

const toOptionalDateRange = (range: { since?: string | undefined; until?: string | undefined }): { since?: string; until?: string } => ({
  ...(range.since ? { since: range.since } : {}),
  ...(range.until ? { until: range.until } : {})
});

const toExportValue = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toExportValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, toExportValue(entry)])
    );
  }

  return value;
};

const toExportRecords = <T>(rows: T[]): Record<string, unknown>[] => rows.map((row) => toExportValue(row) as Record<string, unknown>);

export const exportRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/assets/:assetId/export/pdf", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const query = dateRangeQuerySchema.parse(request.query);
    const range = toOptionalDateRange(query);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const [timelineItems, costSummary] = await Promise.all([
      buildAssetTimeline(app.prisma, asset, range),
      buildAssetCostSummary(app.prisma, asset.id, range)
    ]);
    const doc = generateAssetHistoryPdf({
      asset: {
        name: asset.name,
        category: asset.category,
        make: asset.manufacturer,
        model: asset.model,
        year: null,
        assetTag: asset.assetTag
      },
      timelineItems,
      costSummary,
      dateRangeStart: query.since ? new Date(query.since) : null,
      dateRangeEnd: query.until ? new Date(query.until) : null
    });
    const assetFileTag = sanitizeFileSegment(asset.assetTag ?? asset.id);

    reply.hijack();
    reply.raw.setHeader("content-type", "application/pdf");
    reply.raw.setHeader("content-disposition", `attachment; filename=\"asset-history-${assetFileTag}.pdf\"`);
    doc.pipe(reply.raw);
    doc.end();
    return reply;
  });

  app.get("/v1/assets/:assetId/export/csv", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const query = assetCsvQuerySchema.parse(request.query);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    let csv = "";

    switch (query.dataset) {
      case "timeline": {
        const timelineItems = await buildAssetTimeline(app.prisma, asset, toOptionalDateRange(query));
        csv = buildCsv(
          ["Date", "Source Type", "Title", "Description", "Category", "Cost", "User", "Parts"],
          timelineItems.map((item) => [
            formatCsvDate(item.eventDate),
            formatTimelineSourceLabel(item.sourceType),
            item.title,
            item.description ?? "",
            item.category ?? "",
            item.cost === null ? "" : String(item.cost),
            item.userName ?? "",
            (item.parts ?? []).map((part) => part.name).join("; ")
          ])
        );
        break;
      }

      case "maintenance-logs": {
        const logs = await app.prisma.maintenanceLog.findMany({
          where: {
            assetId: asset.id,
            ...(query.since || query.until
              ? {
                  completedAt: {
                    ...(query.since ? { gte: new Date(query.since) } : {}),
                    ...(query.until ? { lte: new Date(query.until) } : {})
                  }
                }
              : {})
          },
          include: {
            parts: true,
            serviceProvider: {
              select: {
                name: true
              }
            }
          },
          orderBy: { completedAt: "desc" }
        });

        csv = buildCsv(
          ["Completed Date", "Title", "Notes", "Cost", "Labor Hours", "Labor Rate", "Parts Cost", "Total Cost", "Service Provider", "Difficulty Rating"],
          logs.map((log) => {
            const partsCost = log.parts.reduce((sum, part) => sum + part.quantity * (part.unitCost ?? 0), 0);
            const totalCost = computeLogTotalCost(log).totalCost;

            return [
              formatCsvDate(log.completedAt),
              log.title,
              log.notes ?? "",
              log.cost === null ? "" : String(log.cost),
              log.laborHours === null ? "" : String(log.laborHours),
              log.laborRate === null ? "" : String(log.laborRate),
              String(partsCost),
              String(totalCost),
              log.serviceProvider?.name ?? "",
              log.difficultyRating === null ? "" : String(log.difficultyRating)
            ];
          })
        );
        break;
      }

      case "schedules": {
        const schedules = await app.prisma.maintenanceSchedule.findMany({
          where: { assetId: asset.id },
          orderBy: { createdAt: "asc" }
        });

        csv = buildCsv(
          ["Name", "Description", "Trigger Type", "Is Active", "Estimated Cost", "Last Completed", "Next Due Date", "Next Due Metric Value"],
          schedules.map((schedule) => [
            schedule.name,
            schedule.description ?? "",
            schedule.triggerType,
            schedule.isActive ? "Yes" : "No",
            schedule.estimatedCost === null ? "" : String(schedule.estimatedCost),
            schedule.lastCompletedAt ? formatCsvDate(schedule.lastCompletedAt) : "",
            schedule.nextDueAt ? formatCsvDate(schedule.nextDueAt) : "",
            schedule.nextDueMetricValue === null ? "" : String(schedule.nextDueMetricValue)
          ])
        );
        break;
      }

      case "cost-summary": {
        const summary = await buildAssetCostSummary(app.prisma, asset.id, toOptionalDateRange(query));
        csv = buildCsv(
          ["Label", "Value", "Log Count"],
          [
            ["Lifetime Cost", String(summary.lifetimeCost), ""],
            ["YTD Cost", String(summary.yearToDateCost), ""],
            ["Rolling 12-Month Avg", String(summary.rolling12MonthAverage), ""],
            ["", "", ""],
            ...summary.costByYear.map((entry) => [entry.year, String(entry.totalCost), String(entry.logCount)])
          ]
        );
        break;
      }

      case "inventory": {
        const transactions = await app.prisma.inventoryTransaction.findMany({
          where: {
            inventoryItem: {
              assetLinks: {
                some: {
                  assetId: asset.id
                }
              }
            },
            ...(query.since || query.until
              ? {
                  createdAt: {
                    ...(query.since ? { gte: new Date(query.since) } : {}),
                    ...(query.until ? { lte: new Date(query.until) } : {})
                  }
                }
              : {})
          },
          include: {
            inventoryItem: {
              select: {
                name: true,
                partNumber: true
              }
            }
          },
          orderBy: { createdAt: "desc" }
        });

        csv = buildCsv(
          ["Date", "Item Name", "Part Number", "Transaction Type", "Quantity", "Unit Cost", "Total Cost", "Notes"],
          transactions.map((transaction) => [
            formatCsvDate(transaction.createdAt),
            transaction.inventoryItem.name,
            transaction.inventoryItem.partNumber ?? "",
            transaction.type,
            String(transaction.quantity),
            transaction.unitCost === null ? "" : String(transaction.unitCost),
            transaction.unitCost === null ? "" : String(transaction.quantity * transaction.unitCost),
            transaction.notes ?? ""
          ])
        );
        break;
      }
    }

    reply.header("content-type", "text/csv");
    reply.header("content-disposition", `attachment; filename=\"${query.dataset}-${sanitizeFileSegment(asset.assetTag ?? asset.id)}.csv\"`);
    return csv;
  });

  app.get("/v1/households/:householdId/export/csv", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = householdCsvQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    let csv = "";

    switch (query.dataset) {
      case "cost-dashboard": {
        const logs = await app.prisma.maintenanceLog.findMany({
          where: {
            asset: { householdId: params.householdId },
            ...(query.since || query.until
              ? {
                  completedAt: {
                    ...(query.since ? { gte: new Date(query.since) } : {}),
                    ...(query.until ? { lte: new Date(query.until) } : {})
                  }
                }
              : {})
          },
          include: {
            asset: {
              select: {
                id: true,
                name: true,
                category: true
              }
            },
            parts: {
              select: {
                quantity: true,
                unitCost: true
              }
            }
          }
        });
        const assetMap = new Map<string, { assetName: string; category: string; totalCost: number; logCount: number }>();

        for (const log of logs) {
          const entry = assetMap.get(log.asset.id) ?? {
            assetName: log.asset.name,
            category: log.asset.category,
            totalCost: 0,
            logCount: 0
          };
          entry.totalCost += computeLogTotalCost(log).totalCost;
          entry.logCount += 1;
          assetMap.set(log.asset.id, entry);
        }

        csv = buildCsv(
          ["Asset Name", "Category", "Total Cost", "Log Count"],
          Array.from(assetMap.values())
            .sort((left, right) => right.totalCost - left.totalCost)
            .map((entry) => [entry.assetName, entry.category, String(entry.totalCost), String(entry.logCount)])
        );
        break;
      }

      case "activity-log": {
        const activity = await app.prisma.activityLog.findMany({
          where: {
            householdId: params.householdId,
            ...(query.since || query.until
              ? {
                  createdAt: {
                    ...(query.since ? { gte: new Date(query.since) } : {}),
                    ...(query.until ? { lte: new Date(query.until) } : {})
                  }
                }
              : {})
          },
          include: {
            user: {
              select: {
                displayName: true
              }
            }
          },
          orderBy: { createdAt: "desc" }
        });

        csv = buildCsv(
          ["Date", "Action", "Entity Type", "Entity Name", "User", "Details"],
          activity.map((entry) => {
            const metadata = asRecord(entry.metadata);

            return [
              formatCsvDate(entry.createdAt),
              entry.action,
              entry.entityType,
              extractEntityName(metadata, entry.entityId),
              entry.user.displayName ?? "",
              Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : ""
            ];
          })
        );
        break;
      }

      case "schedules-all": {
        const schedules = await app.prisma.maintenanceSchedule.findMany({
          where: {
            asset: {
              householdId: params.householdId
            }
          },
          include: {
            asset: {
              select: {
                name: true
              }
            }
          },
          orderBy: [
            { assetId: "asc" },
            { createdAt: "asc" }
          ]
        });
        const now = Date.now();

        csv = buildCsv(
          ["Asset Name", "Schedule Name", "Trigger Type", "Is Active", "Estimated Cost", "Last Completed", "Next Due Date", "Is Overdue"],
          schedules.map((schedule) => [
            schedule.asset.name,
            schedule.name,
            schedule.triggerType,
            schedule.isActive ? "Yes" : "No",
            schedule.estimatedCost === null ? "" : String(schedule.estimatedCost),
            schedule.lastCompletedAt ? formatCsvDate(schedule.lastCompletedAt) : "",
            schedule.nextDueAt ? formatCsvDate(schedule.nextDueAt) : "",
            schedule.isActive && schedule.nextDueAt ? (schedule.nextDueAt.getTime() < now ? "Yes" : "No") : "No"
          ])
        );
        break;
      }
    }

    reply.header("content-type", "text/csv");
    reply.header("content-disposition", `attachment; filename=\"${query.dataset}-${sanitizeFileSegment(params.householdId)}.csv\"`);
    return csv;
  });

  app.get("/v1/households/:householdId/export/json", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const [
      households,
      members,
      presetProfiles,
      serviceProviders,
      assets,
      assetTransfers,
      usageMetrics,
      usageMetricEntries,
      maintenanceSchedules,
      maintenanceLogs,
      maintenanceLogParts,
      assetTimelineEntries,
      notifications,
      projects,
      projectAssets,
      projectTasks,
      projectNotes,
      projectExpenses,
      projectPhases,
      projectPhaseChecklistItems,
      projectTaskChecklistItems,
      projectBudgetCategories,
      projectPhaseSupplies,
      inventoryItems,
      assetInventoryItems,
      scheduleInventoryItems,
      projectInventoryItems,
      inventoryTransactions,
      activityLogs,
      comments,
      attachments,
      invitations,
      shareLinks,
      hobbies,
      hobbyAssets,
      hobbyInventoryItems,
      hobbyProjectLinks,
      hobbyProjects,
      hobbyProjectMilestones,
      hobbyProjectWorkLogs,
      hobbyProjectInventoryItems,
      hobbyInventoryCategories,
      hobbyRecipes,
      hobbyRecipeIngredients,
      hobbyRecipeSteps,
      hobbySessions,
      hobbySessionIngredients,
      hobbySessionSteps,
      hobbyMetricDefinitions,
      hobbyMetricReadings,
      hobbyLogs
    ] = await Promise.all([
      app.prisma.household.findMany({ where: { id: params.householdId } }),
      app.prisma.householdMember.findMany({
        where: { householdId: params.householdId },
        include: {
          user: true
        }
      }),
      app.prisma.presetProfile.findMany({ where: { householdId: params.householdId } }),
      app.prisma.serviceProvider.findMany({ where: { householdId: params.householdId } }),
      app.prisma.asset.findMany({ where: { householdId: params.householdId } }),
      app.prisma.assetTransfer.findMany({
        where: {
          OR: [{ fromHouseholdId: params.householdId }, { toHouseholdId: params.householdId }]
        }
      }),
      app.prisma.usageMetric.findMany({ where: { asset: { householdId: params.householdId } } }),
      app.prisma.usageMetricEntry.findMany({ where: { metric: { asset: { householdId: params.householdId } } } }),
      app.prisma.maintenanceSchedule.findMany({ where: { asset: { householdId: params.householdId } } }),
      app.prisma.maintenanceLog.findMany({ where: { asset: { householdId: params.householdId } } }),
      app.prisma.maintenanceLogPart.findMany({ where: { log: { asset: { householdId: params.householdId } } } }),
      app.prisma.assetTimelineEntry.findMany({ where: { asset: { householdId: params.householdId } } }),
      app.prisma.notification.findMany({ where: { householdId: params.householdId } }),
      app.prisma.project.findMany({ where: { householdId: params.householdId, deletedAt: null } }),
      app.prisma.projectAsset.findMany({ where: { project: { householdId: params.householdId, deletedAt: null } } }),
      app.prisma.projectTask.findMany({ where: { deletedAt: null, project: { householdId: params.householdId, deletedAt: null } } }),
      app.prisma.projectNote.findMany({ where: { deletedAt: null, project: { householdId: params.householdId, deletedAt: null } } }),
      app.prisma.projectExpense.findMany({ where: { deletedAt: null, project: { householdId: params.householdId, deletedAt: null } } }),
      app.prisma.projectPhase.findMany({ where: { deletedAt: null, project: { householdId: params.householdId, deletedAt: null } } }),
      app.prisma.projectPhaseChecklistItem.findMany({ where: { phase: { deletedAt: null, project: { householdId: params.householdId, deletedAt: null } } } }),
      app.prisma.projectTaskChecklistItem.findMany({ where: { task: { deletedAt: null, project: { householdId: params.householdId, deletedAt: null } } } }),
      app.prisma.projectBudgetCategory.findMany({ where: { project: { householdId: params.householdId, deletedAt: null } } }),
      app.prisma.projectPhaseSupply.findMany({ where: { deletedAt: null, phase: { deletedAt: null, project: { householdId: params.householdId, deletedAt: null } } } }),
      app.prisma.inventoryItem.findMany({ where: { householdId: params.householdId } }),
      app.prisma.assetInventoryItem.findMany({ where: { inventoryItem: { householdId: params.householdId } } }),
      app.prisma.scheduleInventoryItem.findMany({ where: { schedule: { asset: { householdId: params.householdId } } } }),
      app.prisma.projectInventoryItem.findMany({ where: { project: { householdId: params.householdId } } }),
      app.prisma.inventoryTransaction.findMany({ where: { inventoryItem: { householdId: params.householdId } } }),
      app.prisma.activityLog.findMany({ where: { householdId: params.householdId } }),
      app.prisma.comment.findMany({ where: { asset: { householdId: params.householdId } } }),
      app.prisma.attachment.findMany({ where: { householdId: params.householdId } }),
      app.prisma.householdInvitation.findMany({ where: { householdId: params.householdId } }),
      app.prisma.shareLink.findMany({ where: { householdId: params.householdId } }),
      app.prisma.hobby.findMany({ where: { householdId: params.householdId } }),
      app.prisma.hobbyAsset.findMany({ where: { hobby: { householdId: params.householdId } } }),
      app.prisma.hobbyInventoryItem.findMany({ where: { hobby: { householdId: params.householdId } } }),
      app.prisma.hobbyProjectLink.findMany({ where: { hobby: { householdId: params.householdId } } }),
      app.prisma.hobbyProject.findMany({ where: { householdId: params.householdId } }),
      app.prisma.hobbyProjectMilestone.findMany({ where: { hobbyProject: { householdId: params.householdId } } }),
      app.prisma.hobbyProjectWorkLog.findMany({ where: { hobbyProject: { householdId: params.householdId } } }),
      app.prisma.hobbyProjectInventoryItem.findMany({ where: { hobbyProject: { householdId: params.householdId } } }),
      app.prisma.hobbyInventoryCategory.findMany({ where: { hobby: { householdId: params.householdId } } }),
      app.prisma.hobbyRecipe.findMany({ where: { hobby: { householdId: params.householdId } } }),
      app.prisma.hobbyRecipeIngredient.findMany({ where: { recipe: { hobby: { householdId: params.householdId } } } }),
      app.prisma.hobbyRecipeStep.findMany({ where: { recipe: { hobby: { householdId: params.householdId } } } }),
      app.prisma.hobbySession.findMany({ where: { hobby: { householdId: params.householdId } } }),
      app.prisma.hobbySessionIngredient.findMany({ where: { session: { hobby: { householdId: params.householdId } } } }),
      app.prisma.hobbySessionStep.findMany({ where: { session: { hobby: { householdId: params.householdId } } } }),
      app.prisma.hobbyMetricDefinition.findMany({ where: { hobby: { householdId: params.householdId } } }),
      app.prisma.hobbyMetricReading.findMany({ where: { metricDefinition: { hobby: { householdId: params.householdId } } } }),
      app.prisma.hobbyLog.findMany({ where: { hobby: { householdId: params.householdId } } })
    ]);

    const exportPayload = householdDataExportSchema.parse({
      version: 1,
      exportedAt: new Date().toISOString(),
      householdId: params.householdId,
      sections: {
        households: toExportRecords(households),
        members: toExportRecords(members),
        presetProfiles: toExportRecords(presetProfiles),
        serviceProviders: toExportRecords(serviceProviders),
        assets: toExportRecords(assets),
        assetTransfers: toExportRecords(assetTransfers),
        usageMetrics: toExportRecords(usageMetrics),
        usageMetricEntries: toExportRecords(usageMetricEntries),
        maintenanceSchedules: toExportRecords(maintenanceSchedules),
        maintenanceLogs: toExportRecords(maintenanceLogs),
        maintenanceLogParts: toExportRecords(maintenanceLogParts),
        assetTimelineEntries: toExportRecords(assetTimelineEntries),
        notifications: toExportRecords(notifications),
        projects: toExportRecords(projects),
        projectAssets: toExportRecords(projectAssets),
        projectTasks: toExportRecords(projectTasks),
        projectNotes: toExportRecords(projectNotes),
        projectExpenses: toExportRecords(projectExpenses),
        projectPhases: toExportRecords(projectPhases),
        projectPhaseChecklistItems: toExportRecords(projectPhaseChecklistItems),
        projectTaskChecklistItems: toExportRecords(projectTaskChecklistItems),
        projectBudgetCategories: toExportRecords(projectBudgetCategories),
        projectPhaseSupplies: toExportRecords(projectPhaseSupplies),
        inventoryItems: toExportRecords(inventoryItems),
        assetInventoryItems: toExportRecords(assetInventoryItems),
        scheduleInventoryItems: toExportRecords(scheduleInventoryItems),
        projectInventoryItems: toExportRecords(projectInventoryItems),
        inventoryTransactions: toExportRecords(inventoryTransactions),
        activityLogs: toExportRecords(activityLogs),
        comments: toExportRecords(comments),
        attachments: toExportRecords(attachments),
        invitations: toExportRecords(invitations),
        shareLinks: toExportRecords(shareLinks),
        hobbies: toExportRecords(hobbies),
        hobbyAssets: toExportRecords(hobbyAssets),
        hobbyInventoryItems: toExportRecords(hobbyInventoryItems),
        hobbyProjectLinks: toExportRecords(hobbyProjectLinks),
        hobbyProjects: toExportRecords(hobbyProjects),
        hobbyProjectMilestones: toExportRecords(hobbyProjectMilestones),
        hobbyProjectWorkLogs: toExportRecords(hobbyProjectWorkLogs),
        hobbyProjectInventoryItems: toExportRecords(hobbyProjectInventoryItems),
        hobbyInventoryCategories: toExportRecords(hobbyInventoryCategories),
        hobbyRecipes: toExportRecords(hobbyRecipes),
        hobbyRecipeIngredients: toExportRecords(hobbyRecipeIngredients),
        hobbyRecipeSteps: toExportRecords(hobbyRecipeSteps),
        hobbySessions: toExportRecords(hobbySessions),
        hobbySessionIngredients: toExportRecords(hobbySessionIngredients),
        hobbySessionSteps: toExportRecords(hobbySessionSteps),
        hobbyMetricDefinitions: toExportRecords(hobbyMetricDefinitions),
        hobbyMetricReadings: toExportRecords(hobbyMetricReadings),
        hobbyLogs: toExportRecords(hobbyLogs)
      }
    });

    reply.header("content-type", "application/json; charset=utf-8");
    reply.header("content-disposition", `attachment; filename=\"household-export-${sanitizeFileSegment(params.householdId)}.json\"`);

    return exportPayload;
  });
};