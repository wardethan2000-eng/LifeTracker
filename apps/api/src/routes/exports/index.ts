import type { Asset, Prisma, PrismaClient } from "@prisma/client";
import {
  maintenanceTriggerSchema,
  conditionEntrySchema,
  csvExportDatasetSchema,
  householdDataExportSchema,
  type AnnualCostPdfInput,
  type AssetTimelineItem,
  type ComplianceAuditPdfInput,
  type InventoryValuationPdfInput
} from "@lifekeeper/types";
import {
  aggregateCostsByPeriod,
  computeLogTotalCost
} from "@lifekeeper/utils";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getAccessibleAsset, requireHouseholdMembership } from "../../lib/asset-access.js";
import { buildCsv } from "../../lib/csv.js";
import { formatCurrency, formatPercent, formatTimelineSourceLabel } from "../../lib/formatters.js";
import { applyTier } from "../../lib/rate-limit-tiers.js";
import {
  filterReportCyclesInRange,
  summarizeCycles
} from "../../lib/compliance-analytics.js";
import {
  generateAnnualCostPdf,
  generateAssetHistoryPdf,
  generateComplianceAuditPdf,
  generateInventoryValuationPdf
} from "../../lib/pdf-report.js";
import { toEntryBackedTimelineItem, toTimelineItem } from "../../lib/serializers/index.js";
import { buildCompletionCycleLedger } from "../../services/schedule-adherence.js";

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

const annualCostPdfQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100)
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

const formatCsvDate = (value: string | Date): string => new Date(value).toISOString();

const formatMonthKey = (date: Date): string => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

const formatMonthLabel = (date: Date): string => monthLabelFormatter.format(date);

const categoryLabel = (value: string): string => ({
  vehicle: "Vehicle",
  home: "Home",
  marine: "Marine",
  aircraft: "Aircraft",
  yard: "Yard",
  workshop: "Workshop",
  appliance: "Appliance",
  hvac: "HVAC",
  technology: "Technology",
  other: "Other"
}[value] ?? value);

const triggerTypeLabel = (value: string): string => ({
  interval: "Interval",
  usage: "Usage",
  seasonal: "Seasonal",
  compound: "Compound",
  one_time: "One-Time"
}[value] ?? value);

const getIntervalLabel = (triggerConfig: Prisma.JsonValue): string => {
  const trigger = maintenanceTriggerSchema.parse(triggerConfig);

  switch (trigger.type) {
    case "interval":
      return `${trigger.intervalDays} day${trigger.intervalDays === 1 ? "" : "s"}`;
    case "usage":
      return `${trigger.intervalValue} units`;
    case "seasonal":
      return `Seasonal (${trigger.month}/${trigger.day})`;
    case "compound":
      return `${trigger.intervalDays} days or ${trigger.intervalValue} units`;
    case "one_time":
      return `One time (${new Date(trigger.dueAt).toISOString().slice(0, 10)})`;
    default:
      return "Custom";
  }
};

const getEffectiveExpenseDate = (expense: { date: Date | null; createdAt: Date }): Date => expense.date ?? expense.createdAt;

const getYearBounds = (year: number): { start: Date; end: Date } => ({
  start: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
  end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
});

const toDisplayCategory = (value: string | null | undefined): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Uncategorized";
};

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
    prisma.entry.findMany({
      where: {
        householdId: asset.householdId,
        entityType: "asset" as const,
        entityId: asset.id,
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
    ...timelineEntries.map((entry) => toEntryBackedTimelineItem(entry, {
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

export const buildComplianceAuditData = async (
  prisma: PrismaClient,
  asset: Pick<Asset, "id" | "householdId" | "name" | "category" | "manufacturer" | "model" | "assetTag" | "conditionHistory">,
  range: { since?: string | undefined; until?: string | undefined }
): Promise<ComplianceAuditPdfInput> => {
  const [household, schedules, usageReadings] = await Promise.all([
    prisma.household.findUnique({
      where: { id: asset.householdId },
      select: { name: true }
    }),
    prisma.maintenanceSchedule.findMany({
      where: {
        assetId: asset.id,
        deletedAt: null
      },
      include: {
        logs: {
          where: { deletedAt: null },
          include: {
            parts: {
              select: {
                quantity: true,
                unitCost: true
              }
            }
          },
          orderBy: {
            completedAt: "asc"
          }
        }
      },
      orderBy: {
        createdAt: "asc"
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
            name: true,
            unit: true
          }
        }
      },
      orderBy: {
        recordedAt: "desc"
      }
    })
  ]);

  const startDate = range.since ? new Date(range.since) : undefined;
  const endDate = range.until ? new Date(range.until) : undefined;
  const now = new Date();
  const cycleLedger = schedules.length > 0
    ? await buildCompletionCycleLedger(prisma, {
        scheduleIds: schedules.map((schedule) => schedule.id),
        includeOpenCycles: true
      })
    : [];
  const filteredCycles = filterReportCyclesInRange(cycleLedger, startDate, endDate);
  const conditionHistory = conditionEntrySchema.array().safeParse(
    Array.isArray(asset.conditionHistory) ? asset.conditionHistory : []
  );
  const filteredConditions = conditionHistory.success
    ? conditionHistory.data
        .filter((entry) => matchesDateRange(entry.assessedAt, range.since, range.until))
        .sort((left, right) => new Date(right.assessedAt).getTime() - new Date(left.assessedAt).getTime())
    : [];

  let completedOnTime = 0;
  let completedLate = 0;
  let missedOrOverdue = 0;

  const scheduleSections = schedules.map((schedule) => {
    const scheduleCycles = filteredCycles.filter((cycle) => cycle.scheduleId === schedule.id);
    let completedLogIndex = 0;
    const scheduleLogs = schedule.logs;
    const reportableRecords = scheduleCycles
      .filter((cycle) => cycle.completedAt !== null || (cycle.dueDate !== null && new Date(cycle.dueDate) <= now))
      .sort((left, right) => {
        const leftDate = new Date(left.dueDate ?? left.completedAt ?? 0).getTime();
        const rightDate = new Date(right.dueDate ?? right.completedAt ?? 0).getTime();
        return leftDate - rightDate;
      })
      .map((cycle) => {
        if (cycle.completedAt && cycle.deltaInDays !== null && cycle.deltaInDays <= 0) {
          completedOnTime += 1;
        } else if (cycle.completedAt && cycle.deltaInDays !== null && cycle.deltaInDays > 0) {
          completedLate += 1;
        } else if (!cycle.completedAt) {
          missedOrOverdue += 1;
        }

        const matchingLog = cycle.completedAt
          ? scheduleLogs[completedLogIndex++] ?? null
          : null;

        const status: "On Time" | "Late" | "Missed" = cycle.completedAt
          ? (cycle.deltaInDays !== null && cycle.deltaInDays <= 0 ? "On Time" : "Late")
          : "Missed";

        return {
          dueDate: cycle.dueDate,
          completedDate: cycle.completedAt,
          deltaDays: cycle.completedAt
            ? cycle.deltaInDays
            : cycle.dueDate
              ? Math.max(0, Math.floor((now.getTime() - new Date(cycle.dueDate).getTime()) / (24 * 60 * 60 * 1000)))
              : null,
          status,
          cost: matchingLog ? computeLogTotalCost(matchingLog).totalCost : null,
          notes: matchingLog?.notes ?? null
        };
      });
    const scheduleSummary = summarizeCycles(scheduleCycles);

    return {
      scheduleName: schedule.name,
      category: categoryLabel(asset.category),
      triggerType: triggerTypeLabel(schedule.triggerType),
      intervalLabel: getIntervalLabel(schedule.triggerConfig),
      isRegulatory: schedule.isRegulatory,
      evidenceSummary: filteredConditions.length > 0 || usageReadings.length > 0
        ? `Supplementary evidence in range: ${filteredConditions.length} condition assessment${filteredConditions.length === 1 ? "" : "s"}, ${usageReadings.length} usage reading${usageReadings.length === 1 ? "" : "s"}.`
        : null,
      records: reportableRecords,
      summary: scheduleSummary
    };
  });

  const regulatorySections = scheduleSections.filter((section) => section.isRegulatory);
  const regulatoryCycles = filteredCycles.filter((cycle) => regulatorySections.some((section) => section.scheduleName === cycle.scheduleName));
  const regulatorySummary = summarizeCycles(regulatoryCycles);

  return {
    householdName: household?.name ?? "Household",
    generatedAt: new Date(),
    asset: {
      name: asset.name,
      category: asset.category,
      make: asset.manufacturer,
      model: asset.model,
      year: null,
      assetTag: asset.assetTag
    },
    dateRangeStart: startDate ?? null,
    dateRangeEnd: endDate ?? null,
    summary: {
      totalScheduledMaintenanceItems: schedules.length,
      completedOnTime,
      completedLate,
      missedOrOverdue,
      overallOnTimeRate: summarizeCycles(filteredCycles).onTimeRate,
      regulatorySchedulesTracked: regulatorySections.length,
      regulatoryOnTimeRate: regulatorySummary.onTimeRate,
      regulatoryBreakdown: regulatorySections
        .map((section) => ({
          scheduleName: section.scheduleName,
          onTimeRate: section.summary.onTimeRate,
          totalCycles: section.summary.totalCycles
        }))
        .sort((left, right) => right.onTimeRate - left.onTimeRate || left.scheduleName.localeCompare(right.scheduleName)),
      supplementaryEvidence: {
        conditionAssessmentCount: filteredConditions.length,
        usageReadingCount: usageReadings.length,
        latestConditionAssessments: filteredConditions.slice(0, 5).map((entry) => ({
          assessedAt: entry.assessedAt,
          score: entry.score,
          ...(entry.notes ? { notes: entry.notes } : {})
        })),
        latestUsageReadings: usageReadings.slice(0, 5).map((reading) => ({
          metricName: reading.metric.name,
          value: reading.value,
          unit: reading.metric.unit,
          recordedAt: reading.recordedAt.toISOString(),
          notes: reading.notes
        }))
      }
    },
    schedules: scheduleSections.map(({ summary: _summary, ...section }) => section)
  };
};

type AnnualCostRawData = {
  householdName: string;
  maintenanceLogs: Array<{
    assetId: string;
    assetName: string;
    assetCategory: string;
    completedAt: Date;
    totalCost: number;
    providerName: string | null;
  }>;
  projectExpenses: Array<{
    projectName: string;
    amount: number;
    date: Date;
    providerName: string | null;
    assets: Array<{ id: string; name: string; category: string }>;
  }>;
  inventoryPurchases: Array<{
    itemName: string;
    amount: number;
    createdAt: Date;
  }>;
};

const loadAnnualCostRawData = async (
  prisma: PrismaClient,
  householdId: string,
  year: number
): Promise<AnnualCostRawData> => {
  const { start, end } = getYearBounds(year);
  const [household, maintenanceLogs, projectExpenses, inventoryTransactions] = await Promise.all([
    prisma.household.findUnique({
      where: { id: householdId },
      select: { name: true }
    }),
    prisma.maintenanceLog.findMany({
      where: {
        deletedAt: null,
        asset: { householdId },
        completedAt: { gte: start, lte: end }
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
        },
        serviceProvider: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        completedAt: "asc"
      }
    }),
    prisma.projectExpense.findMany({
      where: {
        deletedAt: null,
        project: { householdId, deletedAt: null },
        OR: [
          { date: { gte: start, lte: end } },
          {
            date: null,
            createdAt: { gte: start, lte: end }
          }
        ]
      },
      include: {
        project: {
          select: {
            name: true,
            assets: {
              select: {
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
        },
        serviceProvider: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    }),
    prisma.inventoryTransaction.findMany({
      where: {
        type: "purchase",
        createdAt: { gte: start, lte: end },
        inventoryItem: {
          householdId,
          deletedAt: null
        }
      },
      include: {
        inventoryItem: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    })
  ]);

  return {
    householdName: household?.name ?? "Household",
    maintenanceLogs: maintenanceLogs.map((log) => ({
      assetId: log.asset.id,
      assetName: log.asset.name,
      assetCategory: log.asset.category,
      completedAt: log.completedAt,
      totalCost: computeLogTotalCost(log).totalCost,
      providerName: log.serviceProvider?.name ?? null
    })),
    projectExpenses: projectExpenses.map((expense) => ({
      projectName: expense.project.name,
      amount: expense.amount,
      date: getEffectiveExpenseDate(expense),
      providerName: expense.serviceProvider?.name ?? null,
      assets: expense.project.assets.map((entry) => ({
        id: entry.asset.id,
        name: entry.asset.name,
        category: entry.asset.category
      }))
    })),
    inventoryPurchases: inventoryTransactions.map((transaction) => ({
      itemName: transaction.inventoryItem.name,
      amount: transaction.unitCost !== null && transaction.quantity > 0 ? transaction.quantity * transaction.unitCost : 0,
      createdAt: transaction.createdAt
    }))
  };
};

export const buildAnnualCostData = async (
  prisma: PrismaClient,
  householdId: string,
  year: number
): Promise<AnnualCostPdfInput> => {
  const [currentYearData, priorYearData] = await Promise.all([
    loadAnnualCostRawData(prisma, householdId, year),
    loadAnnualCostRawData(prisma, householdId, year - 1)
  ]);
  const assetBuckets = new Map<string, {
    assetName: string;
    category: string;
    maintenanceCost: number;
    projectCost: number;
  }>();
  const maintenanceCategoryMap = new Map<string, { eventCount: number; totalCost: number }>();
  const providerMap = new Map<string, { providerName: string; eventCount: number; totalSpend: number; assetsServiced: Set<string> }>();
  const monthlyMap = Array.from({ length: 12 }, (_, monthIndex) => {
    const date = new Date(Date.UTC(year, monthIndex, 1));
    return {
      month: formatMonthLabel(date),
      key: formatMonthKey(date),
      maintenanceCost: 0,
      projectCost: 0,
      inventoryCost: 0,
      totalCost: 0
    };
  });
  const monthlyByKey = new Map(monthlyMap.map((entry) => [entry.key, entry]));

  currentYearData.maintenanceLogs.forEach((log) => {
    const existing = assetBuckets.get(log.assetId) ?? {
      assetName: log.assetName,
      category: categoryLabel(log.assetCategory),
      maintenanceCost: 0,
      projectCost: 0
    };
    existing.maintenanceCost += log.totalCost;
    assetBuckets.set(log.assetId, existing);

    const categoryEntry = maintenanceCategoryMap.get(log.assetCategory) ?? { eventCount: 0, totalCost: 0 };
    categoryEntry.eventCount += 1;
    categoryEntry.totalCost += log.totalCost;
    maintenanceCategoryMap.set(log.assetCategory, categoryEntry);

    const monthEntry = monthlyByKey.get(formatMonthKey(log.completedAt));
    if (monthEntry) {
      monthEntry.maintenanceCost += log.totalCost;
      monthEntry.totalCost += log.totalCost;
    }

    if (log.providerName) {
      const providerEntry = providerMap.get(log.providerName) ?? {
        providerName: log.providerName,
        eventCount: 0,
        totalSpend: 0,
        assetsServiced: new Set<string>()
      };
      providerEntry.eventCount += 1;
      providerEntry.totalSpend += log.totalCost;
      providerEntry.assetsServiced.add(log.assetName);
      providerMap.set(log.providerName, providerEntry);
    }
  });

  currentYearData.projectExpenses.forEach((expense) => {
    const assets = expense.assets.length > 0
      ? expense.assets
      : [{ id: "household-unassigned", name: "Household / Unassigned", category: "other" }];
    const allocation = assets.length > 0 ? expense.amount / assets.length : expense.amount;

    assets.forEach((assetEntry) => {
      const existing = assetBuckets.get(assetEntry.id) ?? {
        assetName: assetEntry.name,
        category: categoryLabel(assetEntry.category),
        maintenanceCost: 0,
        projectCost: 0
      };
      existing.projectCost += allocation;
      assetBuckets.set(assetEntry.id, existing);
    });

    const monthEntry = monthlyByKey.get(formatMonthKey(expense.date));
    if (monthEntry) {
      monthEntry.projectCost += expense.amount;
      monthEntry.totalCost += expense.amount;
    }

    if (expense.providerName) {
      const providerEntry = providerMap.get(expense.providerName) ?? {
        providerName: expense.providerName,
        eventCount: 0,
        totalSpend: 0,
        assetsServiced: new Set<string>()
      };
      providerEntry.eventCount += 1;
      providerEntry.totalSpend += expense.amount;
      (expense.assets.length > 0 ? expense.assets : [{ id: expense.projectName, name: expense.projectName, category: "other" }]).forEach((assetEntry) => {
        providerEntry.assetsServiced.add(assetEntry.name);
      });
      providerMap.set(expense.providerName, providerEntry);
    }
  });

  currentYearData.inventoryPurchases.forEach((purchase) => {
    const monthEntry = monthlyByKey.get(formatMonthKey(purchase.createdAt));
    if (monthEntry) {
      monthEntry.inventoryCost += purchase.amount;
      monthEntry.totalCost += purchase.amount;
    }
  });

  const totalMaintenanceCost = currentYearData.maintenanceLogs.reduce((sum, log) => sum + log.totalCost, 0);
  const totalProjectExpenses = currentYearData.projectExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalInventoryPurchases = currentYearData.inventoryPurchases.reduce((sum, purchase) => sum + purchase.amount, 0);
  const grandTotal = totalMaintenanceCost + totalProjectExpenses + totalInventoryPurchases;
  const priorGrandTotal = priorYearData.maintenanceLogs.reduce((sum, log) => sum + log.totalCost, 0)
    + priorYearData.projectExpenses.reduce((sum, expense) => sum + expense.amount, 0)
    + priorYearData.inventoryPurchases.reduce((sum, purchase) => sum + purchase.amount, 0);

  return {
    householdName: currentYearData.householdName,
    year,
    generatedAt: new Date(),
    summary: {
      totalMaintenanceCost,
      totalProjectExpenses,
      totalInventoryPurchases,
      grandTotal,
      assetsMaintainedCount: new Set(currentYearData.maintenanceLogs.map((log) => log.assetId)).size,
      maintenanceEventCount: currentYearData.maintenanceLogs.length,
      averageCostPerMaintenanceEvent: currentYearData.maintenanceLogs.length > 0 ? totalMaintenanceCost / currentYearData.maintenanceLogs.length : 0,
      yearOverYear: priorGrandTotal > 0 || grandTotal > 0
        ? {
            priorYear: year - 1,
            deltaPercent: priorGrandTotal === 0 ? 100 : ((grandTotal - priorGrandTotal) / priorGrandTotal) * 100,
            deltaAmount: grandTotal - priorGrandTotal
          }
        : null
    },
    assetRows: Array.from(assetBuckets.values())
      .map((entry) => ({
        assetName: entry.assetName,
        category: entry.category,
        maintenanceCost: entry.maintenanceCost,
        projectCost: entry.projectCost,
        totalCost: entry.maintenanceCost + entry.projectCost,
        percentOfGrandTotal: grandTotal > 0 ? ((entry.maintenanceCost + entry.projectCost) / grandTotal) * 100 : 0
      }))
      .sort((left, right) => right.totalCost - left.totalCost || left.assetName.localeCompare(right.assetName)),
    monthlyRows: monthlyMap.map(({ key: _key, ...entry }) => entry),
    categoryRows: Array.from(maintenanceCategoryMap.entries())
      .map(([category, entry]) => ({
        category: categoryLabel(category),
        eventCount: entry.eventCount,
        totalCost: entry.totalCost,
        averageCost: entry.eventCount > 0 ? entry.totalCost / entry.eventCount : 0,
        percentOfMaintenanceTotal: totalMaintenanceCost > 0 ? (entry.totalCost / totalMaintenanceCost) * 100 : 0
      }))
      .sort((left, right) => right.totalCost - left.totalCost || left.category.localeCompare(right.category)),
    providerRows: Array.from(providerMap.values())
      .map((entry) => ({
        providerName: entry.providerName,
        eventCount: entry.eventCount,
        totalSpend: entry.totalSpend,
        assetsServiced: Array.from(entry.assetsServiced).sort((left, right) => left.localeCompare(right))
      }))
      .sort((left, right) => right.totalSpend - left.totalSpend || left.providerName.localeCompare(right.providerName))
  };
};

export const buildInventoryValuationData = async (
  prisma: PrismaClient,
  householdId: string
): Promise<InventoryValuationPdfInput> => {
  const [household, items, purchaseTransactions] = await Promise.all([
    prisma.household.findUnique({
      where: { id: householdId },
      select: { name: true }
    }),
    prisma.inventoryItem.findMany({
      where: {
        householdId,
        deletedAt: null
      },
      orderBy: [
        { category: "asc" },
        { name: "asc" }
      ]
    }),
    prisma.inventoryTransaction.findMany({
      where: {
        type: "purchase",
        unitCost: { not: null },
        inventoryItem: {
          householdId,
          deletedAt: null
        }
      },
      select: {
        inventoryItemId: true,
        unitCost: true,
        createdAt: true
      },
      orderBy: [
        { inventoryItemId: "asc" },
        { createdAt: "desc" }
      ]
    })
  ]);

  const latestUnitCostByItem = new Map<string, number>();
  purchaseTransactions.forEach((transaction) => {
    if (!latestUnitCostByItem.has(transaction.inventoryItemId) && transaction.unitCost !== null) {
      latestUnitCostByItem.set(transaction.inventoryItemId, transaction.unitCost);
    }
  });

  const categoryMap = new Map<string, {
    category: string;
    subtotalValue: number;
    items: InventoryValuationPdfInput["categories"][number]["items"];
  }>();
  const reorderAlerts: InventoryValuationPdfInput["reorderAlerts"] = [];
  let totalQuantityOnHand = 0;
  let estimatedTotalValue = 0;
  let itemsBelowReorderPoint = 0;

  items.forEach((item) => {
    const category = toDisplayCategory(item.category);
    const unitCost = latestUnitCostByItem.get(item.id) ?? item.unitCost ?? 0;
    const totalValue = item.quantityOnHand * unitCost;
    const status = item.quantityOnHand <= 0
      ? "Out"
      : item.reorderThreshold !== null && item.quantityOnHand < item.reorderThreshold
        ? "Low"
        : "OK";
    const categoryEntry = categoryMap.get(category) ?? {
      category,
      subtotalValue: 0,
      items: []
    };

    categoryEntry.subtotalValue += totalValue;
    categoryEntry.items.push({
      itemName: item.name,
      quantity: item.quantityOnHand,
      unit: item.unit,
      unitCost,
      totalValue,
      reorderPoint: item.reorderThreshold,
      status
    });
    categoryMap.set(category, categoryEntry);

    totalQuantityOnHand += item.quantityOnHand;
    estimatedTotalValue += totalValue;

    if (item.reorderThreshold !== null && item.quantityOnHand < item.reorderThreshold) {
      itemsBelowReorderPoint += 1;
      reorderAlerts.push({
        itemName: item.name,
        currentQuantity: item.quantityOnHand,
        reorderPoint: item.reorderThreshold,
        deficit: Math.max(0, item.reorderThreshold - item.quantityOnHand)
      });
    }
  });

  return {
    householdName: household?.name ?? "Household",
    asOf: new Date(),
    generatedAt: new Date(),
    summary: {
      totalUniqueItems: items.length,
      totalQuantityOnHand,
      estimatedTotalValue,
      itemsBelowReorderPoint,
      categoriesTracked: categoryMap.size
    },
    reorderAlerts: reorderAlerts.sort((left, right) => right.deficit - left.deficit || left.itemName.localeCompare(right.itemName)),
    categories: Array.from(categoryMap.values())
      .map((entry) => ({
        category: entry.category,
        subtotalValue: entry.subtotalValue,
        items: entry.items.sort((left, right) => left.itemName.localeCompare(right.itemName))
      }))
      .sort((left, right) => left.category.localeCompare(right.category))
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
    if (await applyTier(request, reply, "pdf-export")) return reply;
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

  app.get("/v1/assets/:assetId/export/compliance-pdf", async (request, reply) => {
    if (await applyTier(request, reply, "pdf-export")) return reply;
    const params = assetParamsSchema.parse(request.params);
    const query = dateRangeQuerySchema.parse(request.query);
    const range = toOptionalDateRange(query);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const report = await buildComplianceAuditData(app.prisma, asset, range);
    const doc = generateComplianceAuditPdf(report);
    const assetFileTag = sanitizeFileSegment(asset.assetTag ?? asset.id);

    reply.hijack();
    reply.raw.setHeader("content-type", "application/pdf");
    reply.raw.setHeader("content-disposition", `attachment; filename=\"compliance-audit-${assetFileTag}.pdf\"`);
    doc.pipe(reply.raw);
    doc.end();
    return reply;
  });

  app.get("/v1/assets/:assetId/export/csv", async (request, reply) => {
    if (await applyTier(request, reply, "bulk-export")) return reply;
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
    if (await applyTier(request, reply, "bulk-export")) return reply;
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

  app.get("/v1/households/:householdId/export/annual-cost-pdf", async (request, reply) => {
    if (await applyTier(request, reply, "pdf-export")) return reply;
    const params = householdParamsSchema.parse(request.params);
    const query = annualCostPdfQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const report = await buildAnnualCostData(app.prisma, params.householdId, query.year);
    const doc = generateAnnualCostPdf(report);

    reply.hijack();
    reply.raw.setHeader("content-type", "application/pdf");
    reply.raw.setHeader("content-disposition", `attachment; filename=\"annual-cost-${query.year}-${sanitizeFileSegment(params.householdId)}.pdf\"`);
    doc.pipe(reply.raw);
    doc.end();
    return reply;
  });

  app.get("/v1/households/:householdId/export/inventory-valuation-pdf", async (request, reply) => {
    if (await applyTier(request, reply, "pdf-export")) return reply;
    const params = householdParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const report = await buildInventoryValuationData(app.prisma, params.householdId);
    const doc = generateInventoryValuationPdf(report);

    reply.hijack();
    reply.raw.setHeader("content-type", "application/pdf");
    reply.raw.setHeader("content-disposition", `attachment; filename=\"inventory-valuation-${sanitizeFileSegment(params.householdId)}.pdf\"`);
    doc.pipe(reply.raw);
    doc.end();
    return reply;
  });

  app.get("/v1/households/:householdId/export/json", async (request, reply) => {
    if (await applyTier(request, reply, "bulk-export")) return reply;
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
      notifications,
      projects,
      projectAssets,
      projectTasks,
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
      hobbyMetricReadings
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
      app.prisma.notification.findMany({ where: { householdId: params.householdId } }),
      app.prisma.project.findMany({ where: { householdId: params.householdId, deletedAt: null } }),
      app.prisma.projectAsset.findMany({ where: { project: { householdId: params.householdId, deletedAt: null } } }),
      app.prisma.projectTask.findMany({ where: { deletedAt: null, project: { householdId: params.householdId, deletedAt: null } } }),
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
      app.prisma.hobbyMetricReading.findMany({ where: { metricDefinition: { hobby: { householdId: params.householdId } } } })
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
        notifications: toExportRecords(notifications),
        projects: toExportRecords(projects),
        projectAssets: toExportRecords(projectAssets),
        projectTasks: toExportRecords(projectTasks),
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
        hobbyMetricReadings: toExportRecords(hobbyMetricReadings)
      }
    });

    reply.header("content-type", "application/json; charset=utf-8");
    reply.header("content-disposition", `attachment; filename=\"household-export-${sanitizeFileSegment(params.householdId)}.json\"`);

    return exportPayload;
  });
};