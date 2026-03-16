import type {
  ActivityLog,
  AssetTimelineEntry,
  Comment,
  MaintenanceLog,
  MaintenanceLogPart,
  Prisma,
  UsageMetricEntry
} from "@prisma/client";
import {
  assetTimelineEntrySchema,
  assetTimelineItemSchema,
  type AssetTimelineSourceType
} from "@lifekeeper/types";

type TimelineUserInfo = {
  id: string | null;
  displayName: string | null;
};

type MaintenanceTimelineLog = Pick<MaintenanceLog, "id" | "assetId" | "completedById" | "completedAt" | "cost" | "createdAt" | "title" | "notes" | "scheduleId" | "serviceProviderId" | "difficultyRating" | "laborHours"> & {
  parts?: Array<Pick<MaintenanceLogPart, "name" | "partNumber" | "quantity" | "unitCost">>;
  totalPartsCost?: number | null;
  totalLaborCost?: number | null;
};

type TimelineComment = Pick<Comment, "id" | "assetId" | "authorId" | "body" | "parentCommentId" | "createdAt"> & {
  author?: { id: string; displayName: string | null } | null;
};

type TimelineActivity = Pick<ActivityLog, "id" | "action" | "entityId" | "metadata" | "createdAt"> & {
  assetId?: string;
  user?: { id: string; displayName: string | null } | null;
};

type TimelineUsageReading = Pick<UsageMetricEntry, "id" | "metricId" | "recordedAt" | "value" | "createdAt" | "notes" | "source"> & {
  metric?: { assetId: string; name: string; unit: string } | null;
};

type TimelineConditionAssessment = {
  assetId: string;
  score: number;
  assessedAt: string | Date;
  notes?: string;
};

type TimelineInventoryTransaction = {
  id: string;
  assetId: string;
  type: string;
  quantity: number;
  unitCost?: number | null;
  createdAt: Date;
  inventoryItem?: { name: string } | null;
  userId?: string | null;
  notes?: string | null;
};

const toIsoString = (value: Date | string): string => value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
};

const toDisplayName = (userInfo?: TimelineUserInfo | null): string | null => userInfo?.displayName ?? null;

const buildScheduleTitle = (activity: TimelineActivity): string => {
  const metadata = asRecord(activity.metadata);
  const scheduleName = typeof metadata.name === "string"
    ? metadata.name
    : typeof metadata.scheduleName === "string"
      ? metadata.scheduleName
      : "Schedule";

  switch (activity.action) {
    case "schedule.created":
      return `Schedule created: ${scheduleName}`;
    case "schedule.assigned":
      return `Schedule assigned: ${scheduleName}`;
    case "schedule.completed":
      return `Schedule completed: ${scheduleName}`;
    default:
      return `Schedule updated: ${scheduleName}`;
  }
};

const buildProjectEventTitle = (activity: TimelineActivity): string => {
  const metadata = asRecord(activity.metadata);
  const taskTitle = typeof metadata.taskTitle === "string" ? metadata.taskTitle : null;
  const phaseName = typeof metadata.phaseName === "string"
    ? metadata.phaseName
    : typeof metadata.name === "string"
      ? metadata.name
      : null;

  switch (activity.action) {
    case "project.task.completed":
      return `Project task completed: ${taskTitle ?? "Task"}`;
    case "project.task.assigned":
      return `Project task assigned: ${taskTitle ?? "Task"}`;
    case "project.task.promoted":
      return `Project task promoted: ${taskTitle ?? "Task"}`;
    case "project.quicktodo.created":
      return `Project quick to-do created: ${taskTitle ?? "Task"}`;
    case "project.phase.created":
      return `Project phase created: ${phaseName ?? "Phase"}`;
    case "project.phase.status_changed":
    case "project.phase.status_updated":
      return `Project phase status changed: ${phaseName ?? "Phase"}`;
    case "project.phase.deleted":
      return `Project phase deleted: ${phaseName ?? "Phase"}`;
    default:
      return taskTitle ?? phaseName ?? "Project event";
  }
};

export const toAssetTimelineEntryResponse = (
  entry: Pick<AssetTimelineEntry, "id" | "assetId" | "createdById" | "title" | "description" | "entryDate" | "category" | "cost" | "vendor" | "tags" | "metadata" | "createdAt" | "updatedAt">
) => assetTimelineEntrySchema.parse({
  id: entry.id,
  assetId: entry.assetId,
  createdById: entry.createdById,
  title: entry.title,
  description: entry.description ?? null,
  entryDate: entry.entryDate.toISOString(),
  category: entry.category,
  cost: entry.cost ?? null,
  vendor: entry.vendor ?? null,
  tags: asStringArray(entry.tags),
  metadata: entry.metadata ?? {},
  createdAt: entry.createdAt.toISOString(),
  updatedAt: entry.updatedAt.toISOString()
});

export const toTimelineItem = (
  sourceType: AssetTimelineSourceType,
  raw: unknown,
  userInfo?: TimelineUserInfo | null
) => {
  switch (sourceType) {
    case "maintenance_log": {
      const log = raw as MaintenanceTimelineLog;
      const parts = (log.parts ?? []).map((part) => ({
        name: part.name,
        partNumber: part.partNumber ?? null,
        quantity: part.quantity,
        unitCost: part.unitCost ?? null
      }));
      const totalPartsCost = typeof log.totalPartsCost === "number"
        ? log.totalPartsCost
        : parts.reduce((sum, part) => sum + part.quantity * (part.unitCost ?? 0), 0);
      const totalLaborCost = typeof log.totalLaborCost === "number" ? log.totalLaborCost : 0;
      const baseCost = typeof log.cost === "number" ? log.cost : 0;
      const totalCost = baseCost + totalPartsCost + totalLaborCost;

      return assetTimelineItemSchema.parse({
        id: `log_${log.id}`,
        sourceType,
        sourceId: log.id,
        assetId: log.assetId,
        title: log.title,
        description: log.notes ?? null,
        eventDate: log.completedAt.toISOString(),
        category: "maintenance",
        cost: totalCost > 0 ? totalCost : null,
        userId: log.completedById,
        userName: toDisplayName(userInfo),
        parts,
        metadata: {
          scheduleId: log.scheduleId ?? null,
          serviceProviderId: log.serviceProviderId ?? null,
          difficultyRating: log.difficultyRating ?? null,
          laborHours: log.laborHours ?? null
        },
        isEditable: false,
        createdAt: log.createdAt.toISOString()
      });
    }

    case "timeline_entry": {
      const entry = raw as Pick<AssetTimelineEntry, "id" | "assetId" | "createdById" | "title" | "description" | "entryDate" | "category" | "cost" | "vendor" | "tags" | "metadata" | "createdAt">;

      return assetTimelineItemSchema.parse({
        id: `entry_${entry.id}`,
        sourceType,
        sourceId: entry.id,
        assetId: entry.assetId,
        title: entry.title,
        description: entry.description ?? null,
        eventDate: entry.entryDate.toISOString(),
        category: entry.category,
        cost: entry.cost ?? null,
        userId: entry.createdById,
        userName: toDisplayName(userInfo),
        metadata: {
          vendor: entry.vendor ?? null,
          tags: asStringArray(entry.tags),
          ...(asRecord(entry.metadata))
        },
        isEditable: true,
        createdAt: entry.createdAt.toISOString()
      });
    }

    case "project_event": {
      const activity = raw as TimelineActivity;
      const metadata = asRecord(activity.metadata);

      return assetTimelineItemSchema.parse({
        id: `activity_${activity.id}`,
        sourceType,
        sourceId: activity.id,
        assetId: typeof activity.assetId === "string" ? activity.assetId : String(metadata.assetId ?? ""),
        title: buildProjectEventTitle(activity),
        description: typeof metadata.description === "string" ? metadata.description : null,
        eventDate: activity.createdAt.toISOString(),
        category: "project",
        cost: null,
        userId: userInfo?.id ?? activity.user?.id ?? null,
        userName: userInfo?.displayName ?? activity.user?.displayName ?? null,
        metadata: {
          action: activity.action,
          ...metadata
        },
        isEditable: false,
        createdAt: activity.createdAt.toISOString()
      });
    }

    case "inventory_transaction": {
      const transaction = raw as TimelineInventoryTransaction;
      const itemName = transaction.inventoryItem?.name ?? "Inventory item";
      const totalCost = typeof transaction.unitCost === "number"
        ? transaction.quantity * transaction.unitCost
        : null;

      return assetTimelineItemSchema.parse({
        id: `inventory_${transaction.id}`,
        sourceType,
        sourceId: transaction.id,
        assetId: transaction.assetId,
        title: `${transaction.type}: ${itemName}`,
        description: transaction.notes ?? null,
        eventDate: transaction.createdAt.toISOString(),
        category: "inventory",
        cost: totalCost,
        userId: transaction.userId ?? null,
        userName: toDisplayName(userInfo),
        metadata: {
          quantity: transaction.quantity,
          unitCost: transaction.unitCost ?? null
        },
        isEditable: false,
        createdAt: transaction.createdAt.toISOString()
      });
    }

    case "schedule_change": {
      const activity = raw as TimelineActivity;
      const metadata = asRecord(activity.metadata);

      return assetTimelineItemSchema.parse({
        id: `activity_${activity.id}`,
        sourceType,
        sourceId: activity.id,
        assetId: typeof activity.assetId === "string" ? activity.assetId : String(metadata.assetId ?? ""),
        title: buildScheduleTitle(activity),
        description: typeof metadata.description === "string" ? metadata.description : null,
        eventDate: activity.createdAt.toISOString(),
        category: "schedule",
        cost: null,
        userId: userInfo?.id ?? activity.user?.id ?? null,
        userName: userInfo?.displayName ?? activity.user?.displayName ?? null,
        metadata: {
          action: activity.action,
          ...metadata
        },
        isEditable: false,
        createdAt: activity.createdAt.toISOString()
      });
    }

    case "comment": {
      const comment = raw as TimelineComment;

      return assetTimelineItemSchema.parse({
        id: `comment_${comment.id}`,
        sourceType,
        sourceId: comment.id,
        assetId: comment.assetId,
        title: `Comment by ${comment.author?.displayName ?? userInfo?.displayName ?? "Unknown"}`,
        description: comment.body.length > 500 ? `${comment.body.slice(0, 500).trimEnd()}...` : comment.body,
        eventDate: comment.createdAt.toISOString(),
        category: "comment",
        cost: null,
        userId: comment.authorId,
        userName: comment.author?.displayName ?? userInfo?.displayName ?? null,
        metadata: {
          parentCommentId: comment.parentCommentId ?? null
        },
        isEditable: true,
        createdAt: comment.createdAt.toISOString()
      });
    }

    case "condition_assessment": {
      const assessment = raw as TimelineConditionAssessment;
      const eventDate = toIsoString(assessment.assessedAt);
      const sourceId = `condition_${new Date(eventDate).getTime()}`;

      return assetTimelineItemSchema.parse({
        id: `condition_${sourceId}`,
        sourceType,
        sourceId,
        assetId: assessment.assetId,
        title: `Condition Assessment: ${assessment.score}/10`,
        description: assessment.notes ?? null,
        eventDate,
        category: "condition",
        cost: null,
        userId: null,
        userName: null,
        metadata: {
          score: assessment.score
        },
        isEditable: false,
        createdAt: eventDate
      });
    }

    case "usage_reading": {
      const reading = raw as TimelineUsageReading;
      const metricName = reading.metric?.name ?? "Metric";
      const unit = reading.metric?.unit ? ` ${reading.metric.unit}` : "";

      return assetTimelineItemSchema.parse({
        id: `usage_${reading.id}`,
        sourceType,
        sourceId: reading.id,
        assetId: reading.metric?.assetId ?? "",
        title: `${metricName}: ${reading.value}${unit}`,
        description: reading.notes ?? null,
        eventDate: reading.recordedAt.toISOString(),
        category: "usage",
        cost: null,
        userId: null,
        userName: null,
        metadata: {
          metricId: reading.metricId,
          metricName,
          unit: reading.metric?.unit ?? null,
          source: reading.source
        },
        isEditable: false,
        createdAt: reading.createdAt.toISOString()
      });
    }
  }
};