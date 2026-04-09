import type { NotificationChannel, Prisma, PrismaClient, TriggerType, User } from "@prisma/client";
import {
  notificationPreferencesSchema,
  type CompletionCycleRecord,
  type ComplianceStatus,
  type NotificationPreferences
} from "@aegis/types";
import { MS_PER_DAY, addDays } from "@aegis/utils";
import { buildCompletionCycleLedger } from "../services/schedule-adherence.js";
import type { PrismaExecutor } from "./prisma-types.js";


type ComplianceRecipient = {
  userId: string;
  preferences: NotificationPreferences;
};

type HouseholdContext = {
  id: string;
  name: string;
  members: Array<{
    userId: string;
    user: Pick<User, "id" | "notificationPreferences">;
  }>;
};

type RegulatoryScheduleSummary = {
  id: string;
  name: string;
  description: string | null;
  triggerType: TriggerType;
  asset: {
    id: string;
    name: string;
    category: string;
  };
};

type HouseholdComplianceSnapshot = {
  householdId: string;
  householdName: string;
  overallComplianceStatus: ComplianceStatus;
  summary: {
    totalRegulatorySchedules: number;
    compliantCount: number;
    nonCompliantCount: number;
    currentCount: number;
  };
  nonCompliantSchedules: Array<{
    scheduleId: string;
    scheduleName: string;
    assetId: string;
    assetName: string;
    triggerType: TriggerType;
  }>;
  recipients: ComplianceRecipient[];
};

export interface ComplianceScanResult {
  createdCount: number;
  createdNotificationIds: string[];
}

const parsePreferences = (value: Prisma.JsonValue | null | undefined): NotificationPreferences => notificationPreferencesSchema.parse(value ?? {});

const resolveChannels = (preferences: NotificationPreferences): NotificationChannel[] => {
  if (preferences.pauseAll) {
    return [];
  }

  if (preferences.preferDigest && preferences.enabledChannels.includes("digest")) {
    return ["digest"];
  }

  return preferences.enabledChannels;
};



export const getComplianceStatus = (cycles: CompletionCycleRecord[], gracePeriodDays: number): ComplianceStatus => {
  const now = new Date();
  const lateCycles = cycles.filter((cycle) => cycle.deltaInDays !== null && cycle.deltaInDays > gracePeriodDays);

  if (lateCycles.length > 0) {
    return "non-compliant";
  }

  const overdueOpenCycle = cycles.find((cycle) => {
    if (cycle.completedAt !== null || cycle.dueDate === null) {
      return false;
    }

    const dueDate = new Date(cycle.dueDate);
    return now.getTime() > addDays(dueDate, gracePeriodDays).getTime();
  });

  if (overdueOpenCycle) {
    return "non-compliant";
  }

  if (cycles.some((cycle) => cycle.completedAt === null)) {
    return "current";
  }

  return "compliant";
};

const getComplianceGracePeriodDays = (): number => {
  const parsed = Number(process.env.COMPLIANCE_GRACE_PERIOD_DAYS ?? "0");

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
};

const parsePayloadRecord = (payload: Prisma.JsonValue | null): Record<string, unknown> | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  return payload as Record<string, unknown>;
};

const getPayloadString = (payload: Prisma.JsonValue | null, key: string): string | null => {
  const record = parsePayloadRecord(payload);
  const value = record?.[key];
  return typeof value === "string" ? value : null;
};

const buildNonCompliantSignature = (snapshot: HouseholdComplianceSnapshot): string => snapshot.nonCompliantSchedules
  .map((schedule) => `${schedule.scheduleId}:${schedule.assetId}`)
  .sort((left, right) => left.localeCompare(right))
  .join("|");

const buildAlertBody = (snapshot: HouseholdComplianceSnapshot): string => {
  const names = snapshot.nonCompliantSchedules
    .slice(0, 3)
    .map((schedule) => `${schedule.assetName}: ${schedule.scheduleName}`)
    .join("; ");
  const assetCount = new Set(snapshot.nonCompliantSchedules.map((schedule) => schedule.assetId)).size;
  const base = `${snapshot.summary.nonCompliantCount} regulatory schedule${snapshot.summary.nonCompliantCount === 1 ? " is" : "s are"} non-compliant across ${assetCount} asset${assetCount === 1 ? "" : "s"}.`;

  return names ? `${base} ${names}` : base;
};

const buildResolvedBody = (snapshot: HouseholdComplianceSnapshot): string => snapshot.summary.currentCount > 0
  ? `No regulatory schedules are currently non-compliant. ${snapshot.summary.currentCount} schedule${snapshot.summary.currentCount === 1 ? " remains" : "s remain"} active and current.`
  : "All regulatory schedules are back within the configured grace period.";

const createComplianceNotificationRecord = async (
  prisma: PrismaExecutor,
  snapshot: HouseholdComplianceSnapshot,
  recipient: ComplianceRecipient,
  channel: NotificationChannel,
  now: Date
): Promise<string | null> => {
  const latestNotification = await prisma.notification.findFirst({
    where: {
      userId: recipient.userId,
      householdId: snapshot.householdId,
      channel,
      type: "announcement",
      dedupeKey: {
        startsWith: `${recipient.userId}:${channel}:${snapshot.householdId}:compliance-check:`
      }
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      payload: true
    }
  });

  const latestStatus = getPayloadString(latestNotification?.payload ?? null, "complianceStatus");
  const latestSignature = getPayloadString(latestNotification?.payload ?? null, "signature");

  if (snapshot.overallComplianceStatus === "non-compliant") {
    const signature = buildNonCompliantSignature(snapshot);

    if (latestStatus === "non-compliant" && latestSignature === signature) {
      return null;
    }

    const notification = await prisma.notification.create({
      data: {
        userId: recipient.userId,
        householdId: snapshot.householdId,
        dedupeKey: `${recipient.userId}:${channel}:${snapshot.householdId}:compliance-check:${now.toISOString()}`,
        type: "announcement",
        channel,
        status: "pending",
        title: `Compliance attention needed: ${snapshot.householdName}`,
        body: buildAlertBody(snapshot),
        scheduledFor: now,
        escalationLevel: 0,
        payload: {
          source: "compliance-check",
          complianceStatus: snapshot.overallComplianceStatus,
          signature,
          householdName: snapshot.householdName,
          summary: snapshot.summary,
          schedules: snapshot.nonCompliantSchedules,
          createdAt: now.toISOString()
        } as Prisma.InputJsonValue
      }
    });

    return notification.id;
  }

  if (latestStatus !== "non-compliant") {
    return null;
  }

  const notification = await prisma.notification.create({
    data: {
      userId: recipient.userId,
      householdId: snapshot.householdId,
      dedupeKey: `${recipient.userId}:${channel}:${snapshot.householdId}:compliance-check:${now.toISOString()}`,
      type: "announcement",
      channel,
      status: "pending",
      title: `Compliance restored: ${snapshot.householdName}`,
      body: buildResolvedBody(snapshot),
      scheduledFor: now,
      escalationLevel: 0,
      payload: {
        source: "compliance-check",
        complianceStatus: snapshot.overallComplianceStatus,
        signature: snapshot.overallComplianceStatus,
        householdName: snapshot.householdName,
        summary: snapshot.summary,
        schedules: [],
        createdAt: now.toISOString()
      } as Prisma.InputJsonValue
    }
  });

  return notification.id;
};

const buildHouseholdComplianceSnapshot = async (
  prisma: PrismaExecutor,
  household: HouseholdContext,
  gracePeriodDays: number
): Promise<HouseholdComplianceSnapshot | null> => {
  const regulatorySchedules = await prisma.maintenanceSchedule.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      isRegulatory: true,
      asset: {
        householdId: household.id,
        deletedAt: null,
        isArchived: false
      }
    },
    select: {
      id: true,
      name: true,
      description: true,
      triggerType: true,
      asset: {
        select: {
          id: true,
          name: true,
          category: true
        }
      }
    },
    orderBy: [{ createdAt: "asc" }]
  });

  if (regulatorySchedules.length === 0) {
    return null;
  }

  const cycleLedger = await buildCompletionCycleLedger(prisma, {
    scheduleIds: regulatorySchedules.map((schedule) => schedule.id)
  });
  const scheduleReports = regulatorySchedules.map((schedule) => {
    const cycles = cycleLedger.filter((cycle) => cycle.scheduleId === schedule.id);
    const complianceStatus = getComplianceStatus(cycles, gracePeriodDays);

    return {
      schedule: schedule as RegulatoryScheduleSummary,
      complianceStatus
    };
  });
  const summary = {
    totalRegulatorySchedules: scheduleReports.length,
    compliantCount: scheduleReports.filter((entry) => entry.complianceStatus === "compliant").length,
    nonCompliantCount: scheduleReports.filter((entry) => entry.complianceStatus === "non-compliant").length,
    currentCount: scheduleReports.filter((entry) => entry.complianceStatus === "current").length
  };
  const overallComplianceStatus: ComplianceStatus = summary.nonCompliantCount > 0
    ? "non-compliant"
    : summary.currentCount > 0
      ? "current"
      : "compliant";

  return {
    householdId: household.id,
    householdName: household.name,
    overallComplianceStatus,
    summary,
    nonCompliantSchedules: scheduleReports
      .filter((entry) => entry.complianceStatus === "non-compliant")
      .map((entry) => ({
        scheduleId: entry.schedule.id,
        scheduleName: entry.schedule.name,
        assetId: entry.schedule.asset.id,
        assetName: entry.schedule.asset.name,
        triggerType: entry.schedule.triggerType
      })),
    recipients: household.members.map((member) => ({
      userId: member.userId,
      preferences: parsePreferences(member.user.notificationPreferences)
    }))
  };
};

export const scanComplianceNotifications = async (
  prisma: PrismaClient,
  options: {
    householdId?: string;
    now?: Date;
    gracePeriodDays?: number;
  } = {}
): Promise<ComplianceScanResult> => {
  const now = options.now ?? new Date();
  const gracePeriodDays = options.gracePeriodDays ?? getComplianceGracePeriodDays();
  const households = await prisma.household.findMany({
    where: options.householdId
      ? { id: options.householdId }
      : {
          assets: {
            some: {
              deletedAt: null,
              isArchived: false,
              schedules: {
                some: {
                  deletedAt: null,
                  isActive: true,
                  isRegulatory: true
                }
              }
            }
          }
        },
    select: {
      id: true,
      name: true,
      members: {
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              notificationPreferences: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  const createdNotificationIds: string[] = [];

  for (const household of households) {
    const snapshot = await buildHouseholdComplianceSnapshot(prisma, household as HouseholdContext, gracePeriodDays);

    if (!snapshot) {
      continue;
    }

    for (const recipient of snapshot.recipients) {
      const channels = resolveChannels(recipient.preferences);

      for (const channel of channels) {
        const notificationId = await createComplianceNotificationRecord(
          prisma,
          snapshot,
          recipient,
          channel,
          now
        );

        if (notificationId) {
          createdNotificationIds.push(notificationId);
        }
      }
    }
  }

  return {
    createdCount: createdNotificationIds.length,
    createdNotificationIds
  };
};