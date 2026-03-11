import { z } from "zod";

export const assetCategoryValues = [
  "vehicle",
  "home",
  "marine",
  "yard",
  "workshop",
  "appliance",
  "hvac",
  "technology",
  "other"
] as const;

export const assetVisibilityValues = ["shared", "personal"] as const;
export const householdRoleValues = ["owner", "member"] as const;
export const authSourceValues = ["clerk", "dev-bypass"] as const;
export const notificationTypeValues = ["due_soon", "due", "overdue", "digest", "announcement"] as const;
export const triggerTypeValues = ["interval", "usage", "seasonal", "compound", "one_time"] as const;
export const notificationChannelValues = ["push", "email", "digest"] as const;
export const notificationStatusValues = ["pending", "sent", "failed", "read"] as const;
export const scheduleStatusValues = ["upcoming", "due", "overdue"] as const;
export const presetSourceValues = ["library", "custom"] as const;
export const customFieldTemplateTypeValues = [
  "string",
  "number",
  "boolean",
  "date",
  "select",
  "multiselect",
  "textarea"
] as const;

export const assetCategorySchema = z.enum(assetCategoryValues);
export const assetVisibilitySchema = z.enum(assetVisibilityValues);
export const householdRoleSchema = z.enum(householdRoleValues);
export const authSourceSchema = z.enum(authSourceValues);
export const notificationTypeSchema = z.enum(notificationTypeValues);
export const triggerTypeSchema = z.enum(triggerTypeValues);
export const notificationChannelSchema = z.enum(notificationChannelValues);
export const notificationStatusSchema = z.enum(notificationStatusValues);
export const scheduleStatusSchema = z.enum(scheduleStatusValues);
export const presetSourceSchema = z.enum(presetSourceValues);
export const customFieldTemplateTypeSchema = z.enum(customFieldTemplateTypeValues);

export const notificationConfigSchema = z.object({
  channels: z.array(notificationChannelSchema).min(1).default(["push"]),
  upcomingLeadDays: z.number().int().min(0).optional(),
  upcomingLeadValue: z.number().min(0).optional(),
  sendAtDue: z.boolean().default(true),
  overdueCadenceDays: z.number().int().positive().optional(),
  maxOverdueNotifications: z.number().int().min(0).optional(),
  digest: z.boolean().default(false)
});

export const intervalTriggerSchema = z.object({
  type: z.literal("interval"),
  intervalDays: z.number().int().positive(),
  anchorDate: z.string().datetime().optional(),
  leadTimeDays: z.number().int().min(0).default(0)
});

export const usageTriggerSchema = z.object({
  type: z.literal("usage"),
  metricId: z.string().min(1),
  intervalValue: z.number().positive(),
  leadTimeValue: z.number().min(0).default(0)
});

export const seasonalTriggerSchema = z.object({
  type: z.literal("seasonal"),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  leadTimeDays: z.number().int().min(0).default(0)
});

export const compoundTriggerSchema = z.object({
  type: z.literal("compound"),
  intervalDays: z.number().int().positive(),
  metricId: z.string().min(1),
  intervalValue: z.number().positive(),
  logic: z.enum(["whichever_first", "whichever_last"]),
  leadTimeDays: z.number().int().min(0).default(0),
  leadTimeValue: z.number().min(0).default(0)
});

export const oneTimeTriggerSchema = z.object({
  type: z.literal("one_time"),
  dueAt: z.string().datetime(),
  leadTimeDays: z.number().int().min(0).default(0)
});

export const maintenanceTriggerSchema = z.discriminatedUnion("type", [
  intervalTriggerSchema,
  usageTriggerSchema,
  seasonalTriggerSchema,
  compoundTriggerSchema,
  oneTimeTriggerSchema
]);

export const intervalPresetTriggerSchema = z.object({
  type: z.literal("interval"),
  intervalDays: z.number().int().positive(),
  anchorDate: z.string().datetime().optional(),
  leadTimeDays: z.number().int().min(0).default(0)
});

export const usagePresetTriggerSchema = z.object({
  type: z.literal("usage"),
  metricKey: z.string().min(1),
  intervalValue: z.number().positive(),
  leadTimeValue: z.number().min(0).default(0)
});

export const seasonalPresetTriggerSchema = z.object({
  type: z.literal("seasonal"),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  leadTimeDays: z.number().int().min(0).default(0)
});

export const compoundPresetTriggerSchema = z.object({
  type: z.literal("compound"),
  intervalDays: z.number().int().positive(),
  metricKey: z.string().min(1),
  intervalValue: z.number().positive(),
  logic: z.enum(["whichever_first", "whichever_last"]),
  leadTimeDays: z.number().int().min(0).default(0),
  leadTimeValue: z.number().min(0).default(0)
});

export const oneTimePresetTriggerSchema = z.object({
  type: z.literal("one_time"),
  dueAt: z.string().datetime(),
  leadTimeDays: z.number().int().min(0).default(0)
});

export const presetTriggerSchema = z.discriminatedUnion("type", [
  intervalPresetTriggerSchema,
  usagePresetTriggerSchema,
  seasonalPresetTriggerSchema,
  compoundPresetTriggerSchema,
  oneTimePresetTriggerSchema
]);

export const presetCustomFieldTemplateSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  type: customFieldTemplateTypeSchema,
  required: z.boolean().default(false),
  helpText: z.string().max(500).optional(),
  options: z.array(z.string()).default([]),
  defaultValue: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.null()
  ]).optional()
});

export const presetUsageMetricTemplateSchema = z.object({
  key: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  unit: z.string().min(1).max(40),
  startingValue: z.number().min(0).default(0),
  allowManualEntry: z.boolean().default(true),
  helpText: z.string().max(500).optional()
});

export const presetScheduleTemplateSchema = z.object({
  key: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  triggerTemplate: presetTriggerSchema,
  notificationConfig: notificationConfigSchema.default({
    channels: ["push"],
    sendAtDue: true,
    digest: false
  }),
  tags: z.array(z.string()).default([]),
  quickLogLabel: z.string().max(120).optional()
});

export const presetDefinitionSchema = z.object({
  key: z.string().min(1).max(120),
  label: z.string().min(1).max(160),
  category: assetCategorySchema,
  description: z.string().max(2000).optional(),
  tags: z.array(z.string()).default([]),
  suggestedCustomFields: z.array(presetCustomFieldTemplateSchema).default([]),
  metricTemplates: z.array(presetUsageMetricTemplateSchema).default([]),
  scheduleTemplates: z.array(presetScheduleTemplateSchema).default([])
});

export const libraryPresetSchema = presetDefinitionSchema.extend({
  source: z.literal("library")
});

export const customPresetProfileSchema = presetDefinitionSchema.extend({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  createdById: z.string().cuid(),
  source: z.literal("custom"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createPresetProfileSchema = presetDefinitionSchema.omit({
  key: true
}).extend({
  key: z.string().min(1).max(120).optional()
});

export const updatePresetProfileSchema = createPresetProfileSchema.partial();

export const applyPresetSchema = z.object({
  source: presetSourceSchema,
  presetKey: z.string().min(1).max(120).optional(),
  presetProfileId: z.string().cuid().optional(),
  mergeCustomFields: z.boolean().default(true),
  skipExistingMetrics: z.boolean().default(true),
  skipExistingSchedules: z.boolean().default(true)
}).superRefine((value, context) => {
  if (value.source === "library" && !value.presetKey) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["presetKey"],
      message: "presetKey is required when source is library."
    });
  }

  if (value.source === "custom" && !value.presetProfileId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["presetProfileId"],
      message: "presetProfileId is required when source is custom."
    });
  }
});

export const usageMetricSchema = z.object({
  id: z.string().cuid().optional(),
  assetId: z.string().cuid().optional(),
  name: z.string().min(1).max(80),
  unit: z.string().min(1).max(40),
  currentValue: z.number().min(0).default(0),
  lastRecordedAt: z.string().datetime().optional()
});

export const createUsageMetricSchema = z.object({
  name: z.string().min(1).max(80),
  unit: z.string().min(1).max(40),
  currentValue: z.number().min(0).default(0),
  lastRecordedAt: z.string().datetime().optional()
});

export const updateUsageMetricSchema = createUsageMetricSchema.partial();

export const usageMetricResponseSchema = z.object({
  id: z.string().cuid(),
  assetId: z.string().cuid(),
  name: z.string(),
  unit: z.string(),
  currentValue: z.number(),
  lastRecordedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const assetCustomFieldsSchema = z.record(z.string(), z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null()
]));

export const createAssetSchema = z.object({
  householdId: z.string().cuid(),
  name: z.string().min(1).max(120),
  category: assetCategorySchema,
  visibility: assetVisibilitySchema.default("shared"),
  description: z.string().max(1000).optional(),
  manufacturer: z.string().max(120).optional(),
  model: z.string().max(120).optional(),
  serialNumber: z.string().max(120).optional(),
  purchaseDate: z.string().datetime().optional(),
  customFields: assetCustomFieldsSchema.default({})
});

export const updateAssetSchema = createAssetSchema.omit({ householdId: true }).partial();

export const assetSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  createdById: z.string().cuid(),
  name: z.string(),
  category: assetCategorySchema,
  visibility: assetVisibilitySchema,
  description: z.string().nullable(),
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  serialNumber: z.string().nullable(),
  purchaseDate: z.string().datetime().nullable(),
  customFields: assetCustomFieldsSchema,
  isArchived: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const notificationPreferencesSchema = z.object({
  pauseAll: z.boolean().default(false),
  enabledChannels: z.array(notificationChannelSchema).min(1).default(["push"]),
  preferDigest: z.boolean().default(false)
});

export const userProfileSchema = z.object({
  id: z.string().cuid(),
  clerkUserId: z.string(),
  email: z.string().email().nullable(),
  displayName: z.string().nullable(),
  notificationPreferences: notificationPreferencesSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createHouseholdSchema = z.object({
  name: z.string().min(1).max(120)
});

export const updateHouseholdSchema = z.object({
  name: z.string().min(1).max(120).optional()
});

export const householdSummarySchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  createdById: z.string().cuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  memberCount: z.number().int().min(0),
  myRole: householdRoleSchema
});

export const addHouseholdMemberSchema = z.object({
  userId: z.string().cuid().optional(),
  clerkUserId: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  role: householdRoleSchema.default("member")
}).superRefine((value, context) => {
  if (!value.userId && !value.clerkUserId && !value.email) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["userId"],
      message: "Provide userId, clerkUserId, or email when adding a household member."
    });
  }
});

export const updateHouseholdMemberSchema = z.object({
  role: householdRoleSchema.optional()
});

export const householdMemberSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  userId: z.string().cuid(),
  role: householdRoleSchema,
  joinedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  user: userProfileSchema
});

export const meResponseSchema = z.object({
  user: userProfileSchema,
  auth: z.object({
    source: authSourceSchema,
    clerkUserId: z.string().nullable()
  }),
  households: z.array(householdSummarySchema)
});

export const notificationPayloadSchema = z.record(z.string(), z.unknown());

export const notificationSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  householdId: z.string().cuid().nullable(),
  assetId: z.string().cuid().nullable(),
  scheduleId: z.string().cuid().nullable(),
  dedupeKey: z.string(),
  type: notificationTypeSchema,
  channel: notificationChannelSchema,
  status: notificationStatusSchema,
  title: z.string(),
  body: z.string(),
  scheduledFor: z.string().datetime(),
  sentAt: z.string().datetime().nullable(),
  readAt: z.string().datetime().nullable(),
  escalationLevel: z.number().int().min(0),
  payload: notificationPayloadSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const updateNotificationPreferencesSchema = notificationPreferencesSchema.partial();

export const assetOverviewSchema = z.object({
  asset: assetSchema,
  dueScheduleCount: z.number().int().min(0),
  overdueScheduleCount: z.number().int().min(0),
  nextDueAt: z.string().datetime().nullable(),
  lastCompletedAt: z.string().datetime().nullable()
});

export const dueWorkItemSchema = z.object({
  assetId: z.string().cuid(),
  assetName: z.string(),
  assetCategory: assetCategorySchema,
  scheduleId: z.string().cuid(),
  scheduleName: z.string(),
  status: scheduleStatusSchema,
  nextDueAt: z.string().datetime().nullable(),
  nextDueMetricValue: z.number().nullable(),
  currentMetricValue: z.number().nullable(),
  metricUnit: z.string().nullable(),
  summary: z.string()
});

export const householdDashboardStatsSchema = z.object({
  assetCount: z.number().int().min(0),
  dueScheduleCount: z.number().int().min(0),
  overdueScheduleCount: z.number().int().min(0),
  unreadNotificationCount: z.number().int().min(0)
});

export const householdDashboardSchema = z.object({
  household: householdSummarySchema,
  stats: householdDashboardStatsSchema,
  dueWork: z.array(dueWorkItemSchema),
  assets: z.array(assetOverviewSchema),
  notifications: z.array(notificationSchema)
});

export const createMaintenanceScheduleSchema = z.object({
  assetId: z.string().cuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  triggerConfig: maintenanceTriggerSchema,
  notificationConfig: notificationConfigSchema.default({
    channels: ["push"],
    sendAtDue: true,
    digest: false
  }),
  metricId: z.string().cuid().optional(),
  presetKey: z.string().max(160).optional()
});

export const updateMaintenanceScheduleSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).optional(),
  triggerConfig: maintenanceTriggerSchema.optional(),
  notificationConfig: notificationConfigSchema.optional(),
  metricId: z.string().cuid().optional(),
  presetKey: z.string().max(160).optional(),
  isActive: z.boolean().optional(),
  lastCompletedAt: z.string().datetime().optional()
});

export const maintenanceScheduleSchema = z.object({
  id: z.string().cuid(),
  assetId: z.string().cuid(),
  metricId: z.string().cuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  triggerType: triggerTypeSchema,
  triggerConfig: maintenanceTriggerSchema,
  notificationConfig: notificationConfigSchema,
  presetKey: z.string().nullable(),
  isActive: z.boolean(),
  lastCompletedAt: z.string().datetime().nullable(),
  nextDueAt: z.string().datetime().nullable(),
  nextDueMetricValue: z.number().nullable(),
  status: scheduleStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const maintenanceLogMetadataSchema = z.record(z.string(), z.unknown());

export const createMaintenanceLogSchema = z.object({
  scheduleId: z.string().cuid().optional(),
  title: z.string().min(1).max(120).optional(),
  notes: z.string().max(2000).optional(),
  completedAt: z.string().datetime().optional(),
  usageValue: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  metadata: maintenanceLogMetadataSchema.default({})
});

export const updateMaintenanceLogSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  notes: z.string().max(2000).optional(),
  completedAt: z.string().datetime().optional(),
  usageValue: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  metadata: maintenanceLogMetadataSchema.optional()
});

export const completeMaintenanceScheduleSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  notes: z.string().max(2000).optional(),
  completedAt: z.string().datetime().optional(),
  usageValue: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  metadata: maintenanceLogMetadataSchema.default({})
});

export const maintenanceLogSchema = z.object({
  id: z.string().cuid(),
  assetId: z.string().cuid(),
  scheduleId: z.string().cuid().nullable(),
  completedById: z.string().cuid(),
  title: z.string(),
  notes: z.string().nullable(),
  completedAt: z.string().datetime(),
  usageValue: z.number().nullable(),
  cost: z.number().nullable(),
  metadata: maintenanceLogMetadataSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const assetDetailResponseSchema = z.object({
  asset: assetSchema,
  metrics: z.array(usageMetricResponseSchema),
  schedules: z.array(maintenanceScheduleSchema),
  recentLogs: z.array(maintenanceLogSchema),
  dueScheduleCount: z.number().int().min(0),
  overdueScheduleCount: z.number().int().min(0)
});

export type AssetCategory = z.infer<typeof assetCategorySchema>;
export type AssetVisibility = z.infer<typeof assetVisibilitySchema>;
export type HouseholdRole = z.infer<typeof householdRoleSchema>;
export type AuthSource = z.infer<typeof authSourceSchema>;
export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type TriggerType = z.infer<typeof triggerTypeSchema>;
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;
export type ScheduleStatus = z.infer<typeof scheduleStatusSchema>;
export type PresetSource = z.infer<typeof presetSourceSchema>;
export type CustomFieldTemplateType = z.infer<typeof customFieldTemplateTypeSchema>;
export type NotificationConfig = z.infer<typeof notificationConfigSchema>;
export type IntervalTriggerSchema = z.infer<typeof intervalTriggerSchema>;
export type UsageTriggerSchema = z.infer<typeof usageTriggerSchema>;
export type SeasonalTriggerSchema = z.infer<typeof seasonalTriggerSchema>;
export type CompoundTriggerSchema = z.infer<typeof compoundTriggerSchema>;
export type OneTimeTriggerSchema = z.infer<typeof oneTimeTriggerSchema>;
export type MaintenanceTrigger = z.infer<typeof maintenanceTriggerSchema>;
export type PresetTrigger = z.infer<typeof presetTriggerSchema>;
export type PresetCustomFieldTemplate = z.infer<typeof presetCustomFieldTemplateSchema>;
export type PresetUsageMetricTemplate = z.infer<typeof presetUsageMetricTemplateSchema>;
export type PresetScheduleTemplate = z.infer<typeof presetScheduleTemplateSchema>;
export type PresetDefinition = z.infer<typeof presetDefinitionSchema>;
export type LibraryPreset = z.infer<typeof libraryPresetSchema>;
export type CustomPresetProfile = z.infer<typeof customPresetProfileSchema>;
export type CreatePresetProfileInput = z.infer<typeof createPresetProfileSchema>;
export type UpdatePresetProfileInput = z.infer<typeof updatePresetProfileSchema>;
export type ApplyPresetInput = z.infer<typeof applyPresetSchema>;
export type UsageMetricInput = z.infer<typeof usageMetricSchema>;
export type CreateUsageMetricInput = z.infer<typeof createUsageMetricSchema>;
export type UpdateUsageMetricInput = z.infer<typeof updateUsageMetricSchema>;
export type UsageMetric = z.infer<typeof usageMetricResponseSchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type UpdateHouseholdInput = z.infer<typeof updateHouseholdSchema>;
export type HouseholdSummary = z.infer<typeof householdSummarySchema>;
export type AddHouseholdMemberInput = z.infer<typeof addHouseholdMemberSchema>;
export type UpdateHouseholdMemberInput = z.infer<typeof updateHouseholdMemberSchema>;
export type HouseholdMember = z.infer<typeof householdMemberSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;
export type AssetOverview = z.infer<typeof assetOverviewSchema>;
export type DueWorkItem = z.infer<typeof dueWorkItemSchema>;
export type HouseholdDashboardStats = z.infer<typeof householdDashboardStatsSchema>;
export type HouseholdDashboard = z.infer<typeof householdDashboardSchema>;
export type AssetDetailResponse = z.infer<typeof assetDetailResponseSchema>;
export type CreateMaintenanceScheduleInput = z.infer<typeof createMaintenanceScheduleSchema>;
export type UpdateMaintenanceScheduleInput = z.infer<typeof updateMaintenanceScheduleSchema>;
export type MaintenanceSchedule = z.infer<typeof maintenanceScheduleSchema>;
export type CreateMaintenanceLogInput = z.infer<typeof createMaintenanceLogSchema>;
export type UpdateMaintenanceLogInput = z.infer<typeof updateMaintenanceLogSchema>;
export type CompleteMaintenanceScheduleInput = z.infer<typeof completeMaintenanceScheduleSchema>;
export type MaintenanceLog = z.infer<typeof maintenanceLogSchema>;

