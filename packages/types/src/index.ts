import { z } from "zod";

export const assetCategoryValues = [
  "vehicle",
  "home",
  "marine",
  "aircraft",
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
export const inventoryTransactionTypeValues = ["purchase", "consume", "adjust", "return", "transfer"] as const;
export const scheduleStatusValues = ["upcoming", "due", "overdue"] as const;
export const presetSourceValues = ["library", "custom"] as const;
export const assetTypeSourceValues = ["manual", "library", "custom", "inline"] as const;
export const assetTransferTypeValues = ["reassignment", "household_transfer"] as const;
export const assetFieldTypeValues = [
  "string",
  "number",
  "boolean",
  "date",
  "select",
  "multiselect",
  "textarea",
  "url",
  "currency"
] as const;
export const customFieldTemplateTypeValues = assetFieldTypeValues;

export const assetCategorySchema = z.enum(assetCategoryValues);
export const assetVisibilitySchema = z.enum(assetVisibilityValues);
export const householdRoleSchema = z.enum(householdRoleValues);
export const authSourceSchema = z.enum(authSourceValues);
export const notificationTypeSchema = z.enum(notificationTypeValues);
export const triggerTypeSchema = z.enum(triggerTypeValues);
export const notificationChannelSchema = z.enum(notificationChannelValues);
export const notificationStatusSchema = z.enum(notificationStatusValues);
export const inventoryTransactionTypeSchema = z.enum(inventoryTransactionTypeValues);
export const scheduleStatusSchema = z.enum(scheduleStatusValues);
export const presetSourceSchema = z.enum(presetSourceValues);
export const assetTypeSourceSchema = z.enum(assetTypeSourceValues);
export const assetTransferTypeSchema = z.enum(assetTransferTypeValues);
export const assetFieldTypeSchema = z.enum(assetFieldTypeValues);
export const customFieldTemplateTypeSchema = assetFieldTypeSchema;
export const assetTagSchema = z.string().trim().toUpperCase().regex(/^LK-[A-Z0-9]{8,}$/);

export const assetFieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null()
]);

export const assetFieldOptionSchema = z.object({
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(120)
});

export const assetFieldDefinitionSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  type: assetFieldTypeSchema,
  required: z.boolean().default(false),
  helpText: z.string().max(500).optional(),
  placeholder: z.string().max(160).optional(),
  unit: z.string().max(40).optional(),
  group: z.string().max(80).optional(),
  wide: z.boolean().default(false),
  order: z.number().int().min(0).default(0),
  options: z.array(assetFieldOptionSchema).default([]),
  defaultValue: assetFieldValueSchema.optional()
});

export const assetFieldDefinitionsSchema = z.array(assetFieldDefinitionSchema);

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
  placeholder: z.string().max(160).optional(),
  unit: z.string().max(40).optional(),
  group: z.string().max(80).optional(),
  wide: z.boolean().default(false),
  order: z.number().int().min(0).default(0),
  options: z.array(z.string()).default([]),
  defaultValue: assetFieldValueSchema.optional()
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

export const assetCustomFieldsSchema = z.record(z.string(), assetFieldValueSchema);

// ── Structured Asset Detail Schemas ──────────────────────────────────

export const purchaseConditionValues = ["new", "used", "refurbished"] as const;
export const purchaseConditionSchema = z.enum(purchaseConditionValues);

export const purchaseDetailsSchema = z.object({
  price: z.number().min(0).optional(),
  vendor: z.string().max(200).optional(),
  condition: purchaseConditionSchema.optional(),
  financing: z.string().max(500).optional(),
  receiptRef: z.string().max(500).optional()
});

export const warrantyDetailsSchema = z.object({
  provider: z.string().max(200).optional(),
  policyNumber: z.string().max(120).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  coverageType: z.string().max(200).optional(),
  notes: z.string().max(2000).optional()
});

export const locationDetailsSchema = z.object({
  propertyName: z.string().max(200).optional(),
  building: z.string().max(200).optional(),
  room: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  notes: z.string().max(2000).optional()
});

export const insuranceDetailsSchema = z.object({
  provider: z.string().max(200).optional(),
  policyNumber: z.string().max(120).optional(),
  coverageAmount: z.number().min(0).optional(),
  deductible: z.number().min(0).optional(),
  renewalDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional()
});

export const disposalMethodValues = ["sold", "donated", "scrapped", "recycled", "lost"] as const;
export const disposalMethodSchema = z.enum(disposalMethodValues);

export const dispositionDetailsSchema = z.object({
  method: disposalMethodSchema.optional(),
  date: z.string().datetime().optional(),
  salePrice: z.number().min(0).optional(),
  buyerInfo: z.string().max(500).optional(),
  notes: z.string().max(2000).optional()
});

export const conditionEntrySchema = z.object({
  score: z.number().int().min(1).max(10),
  assessedAt: z.string().datetime(),
  notes: z.string().max(2000).optional()
});

export const createConditionAssessmentSchema = z.object({
  score: z.number().int().min(1).max(10),
  notes: z.string().max(2000).optional()
});

// ── Usage Metric Entry Schemas ───────────────────────────────────────

export const usageMetricEntrySchema = z.object({
  id: z.string().cuid(),
  metricId: z.string().cuid(),
  value: z.number(),
  recordedAt: z.string().datetime(),
  source: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createUsageMetricEntrySchema = z.object({
  value: z.number(),
  recordedAt: z.string().datetime().optional(),
  source: z.string().max(80).default("manual"),
  notes: z.string().max(2000).optional()
});

export const usageProjectionSchema = z.object({
  metricId: z.string().cuid(),
  currentRate: z.number(),
  rateUnit: z.string(),
  projectedValues: z.array(z.object({
    date: z.string().datetime(),
    value: z.number()
  }))
});

// ── Service Provider Schemas ─────────────────────────────────────────

export const serviceProviderSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  name: z.string(),
  specialty: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  address: z.string().nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createServiceProviderSchema = z.object({
  name: z.string().min(1).max(200),
  specialty: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().max(255).optional(),
  website: z.string().max(500).optional(),
  address: z.string().max(500).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(2000).optional()
});

export const updateServiceProviderSchema = createServiceProviderSchema.partial();

// ── Maintenance Log Part Schemas ─────────────────────────────────────

export const maintenanceLogPartSchema = z.object({
  id: z.string().cuid(),
  logId: z.string().cuid(),
  inventoryItemId: z.string().cuid().nullable().default(null),
  name: z.string(),
  partNumber: z.string().nullable(),
  quantity: z.number(),
  unitCost: z.number().nullable(),
  supplier: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createMaintenanceLogPartSchema = z.object({
  name: z.string().min(1).max(200),
  inventoryItemId: z.string().cuid().optional(),
  partNumber: z.string().max(120).optional(),
  quantity: z.number().min(0).default(1),
  unitCost: z.number().min(0).optional(),
  supplier: z.string().max(200).optional(),
  notes: z.string().max(2000).optional()
});

export const updateMaintenanceLogPartSchema = createMaintenanceLogPartSchema.partial();

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
  parentAssetId: z.string().cuid().optional(),
  purchaseDetails: z.lazy(() => purchaseDetailsSchema).optional(),
  warrantyDetails: z.lazy(() => warrantyDetailsSchema).optional(),
  locationDetails: z.lazy(() => locationDetailsSchema).optional(),
  insuranceDetails: z.lazy(() => insuranceDetailsSchema).optional(),
  dispositionDetails: z.lazy(() => dispositionDetailsSchema).optional(),
  conditionScore: z.number().int().min(1).max(10).optional(),
  assetTypeKey: z.string().min(1).max(120).optional(),
  assetTypeLabel: z.string().min(1).max(160).optional(),
  assetTypeDescription: z.string().max(2000).optional(),
  assetTypeSource: assetTypeSourceSchema.default("manual"),
  assetTypeVersion: z.number().int().positive().default(1),
  fieldDefinitions: assetFieldDefinitionsSchema.default([]),
  customFields: assetCustomFieldsSchema.default({})
});

export const updateAssetSchema = createAssetSchema.omit({ householdId: true }).partial();

export const shallowAssetSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  category: assetCategorySchema
});

export const assetLookupQuerySchema = z.object({
  tag: assetTagSchema
});

export const assetLabelDataSchema = z.object({
  assetId: z.string().cuid(),
  assetTag: assetTagSchema,
  name: z.string(),
  serialNumber: z.string().nullable(),
  category: assetCategorySchema,
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  qrPayloadUrl: z.string().url()
});

export const assetSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  createdById: z.string().cuid(),
  ownerId: z.string().cuid().nullable().default(null),
  parentAssetId: z.string().cuid().nullable().default(null),
  assetTag: assetTagSchema,
  name: z.string(),
  category: assetCategorySchema,
  visibility: assetVisibilitySchema,
  description: z.string().nullable(),
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  serialNumber: z.string().nullable(),
  purchaseDate: z.string().datetime().nullable(),
  purchaseDetails: z.lazy(() => purchaseDetailsSchema).nullable().default(null),
  warrantyDetails: z.lazy(() => warrantyDetailsSchema).nullable().default(null),
  locationDetails: z.lazy(() => locationDetailsSchema).nullable().default(null),
  insuranceDetails: z.lazy(() => insuranceDetailsSchema).nullable().default(null),
  dispositionDetails: z.lazy(() => dispositionDetailsSchema).nullable().default(null),
  conditionScore: z.number().int().min(1).max(10).nullable().default(null),
  conditionHistory: z.lazy(() => z.array(conditionEntrySchema)).default([]),
  parentAsset: shallowAssetSchema.nullable().default(null),
  childAssets: z.array(shallowAssetSchema).default([]),
  assetTypeKey: z.string().nullable(),
  assetTypeLabel: z.string().nullable(),
  assetTypeDescription: z.string().nullable(),
  assetTypeSource: assetTypeSourceSchema,
  assetTypeVersion: z.number().int().positive(),
  fieldDefinitions: assetFieldDefinitionsSchema,
  customFields: assetCustomFieldsSchema,
  isArchived: z.boolean(),
  deletedAt: z.string().datetime().nullable().default(null),
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
  presetKey: z.string().max(160).optional(),
  assignedToId: z.string().cuid().optional()
});

export const updateMaintenanceScheduleSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).optional(),
  triggerConfig: maintenanceTriggerSchema.optional(),
  notificationConfig: notificationConfigSchema.optional(),
  metricId: z.string().cuid().optional(),
  presetKey: z.string().max(160).optional(),
  isActive: z.boolean().optional(),
  lastCompletedAt: z.string().datetime().optional(),
  assignedToId: z.string().cuid().nullable().optional()
});

export const shallowUserSchema = z.object({
  id: z.string().cuid(),
  displayName: z.string().nullable()
});

export const assetTransferSchema = z.object({
  id: z.string().cuid(),
  assetId: z.string().cuid(),
  transferType: assetTransferTypeSchema,
  fromHouseholdId: z.string().cuid(),
  toHouseholdId: z.string().cuid().nullable().default(null),
  fromUserId: z.string().cuid(),
  toUserId: z.string().cuid(),
  initiatedById: z.string().cuid(),
  reason: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  transferredAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  fromUser: shallowUserSchema,
  toUser: shallowUserSchema,
  initiatedBy: shallowUserSchema
});

export const createAssetTransferSchema = z.object({
  transferType: assetTransferTypeSchema,
  toUserId: z.string().cuid(),
  toHouseholdId: z.string().cuid().optional(),
  reason: z.string().max(200).optional(),
  notes: z.string().max(4000).optional()
}).superRefine((value, context) => {
  if (value.transferType === "household_transfer" && !value.toHouseholdId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["toHouseholdId"],
      message: "toHouseholdId is required for household transfers."
    });
  }
});

export const assetTransferListSchema = z.object({
  items: z.array(assetTransferSchema),
  nextCursor: z.string().cuid().nullable().default(null)
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
  assignedToId: z.string().cuid().nullable().default(null),
  assignee: shallowUserSchema.nullable().default(null),
  status: scheduleStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const maintenanceLogMetadataSchema = z.record(z.string(), z.unknown());

export const createMaintenanceLogSchema = z.object({
  scheduleId: z.string().cuid().optional(),
  serviceProviderId: z.string().cuid().optional(),
  title: z.string().min(1).max(120).optional(),
  notes: z.string().max(2000).optional(),
  completedAt: z.string().datetime().optional(),
  usageValue: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  laborHours: z.number().min(0).optional(),
  laborRate: z.number().min(0).optional(),
  difficultyRating: z.number().int().min(1).max(5).optional(),
  performedBy: z.string().min(1).max(200).optional(),
  metadata: maintenanceLogMetadataSchema.default({}),
  parts: z.array(createMaintenanceLogPartSchema).optional()
});

export const updateMaintenanceLogSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  notes: z.string().max(2000).optional(),
  completedAt: z.string().datetime().optional(),
  usageValue: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  serviceProviderId: z.string().cuid().nullable().optional(),
  laborHours: z.number().min(0).optional(),
  laborRate: z.number().min(0).optional(),
  difficultyRating: z.number().int().min(1).max(5).optional(),
  performedBy: z.string().min(1).max(200).nullable().optional(),
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
  serviceProviderId: z.string().cuid().nullable().default(null),
  title: z.string(),
  notes: z.string().nullable(),
  completedAt: z.string().datetime(),
  usageValue: z.number().nullable(),
  cost: z.number().nullable(),
  laborHours: z.number().nullable().default(null),
  laborRate: z.number().nullable().default(null),
  difficultyRating: z.number().int().min(1).max(5).nullable().default(null),
  performedBy: z.string().nullable().default(null),
  metadata: maintenanceLogMetadataSchema,
  parts: z.array(maintenanceLogPartSchema).default([]),
  totalPartsCost: z.number().default(0),
  totalLaborCost: z.number().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// ── Inventory Schemas ───────────────────────────────────────────────

export const inventoryItemSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  name: z.string(),
  partNumber: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  manufacturer: z.string().nullable(),
  quantityOnHand: z.number(),
  unit: z.string(),
  reorderThreshold: z.number().nullable(),
  reorderQuantity: z.number().nullable(),
  preferredSupplier: z.string().nullable(),
  supplierUrl: z.string().nullable(),
  unitCost: z.number().nullable(),
  storageLocation: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createInventoryItemSchema = z.object({
  name: z.string().min(1).max(200),
  partNumber: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(120).optional(),
  manufacturer: z.string().max(120).optional(),
  quantityOnHand: z.number().default(0),
  unit: z.string().min(1).max(60).default("each"),
  reorderThreshold: z.number().min(0).optional(),
  reorderQuantity: z.number().min(0).optional(),
  preferredSupplier: z.string().max(200).optional(),
  supplierUrl: z.string().url().max(1000).optional(),
  unitCost: z.number().min(0).optional(),
  storageLocation: z.string().max(200).optional(),
  notes: z.string().max(4000).optional()
});

export const updateInventoryItemSchema = createInventoryItemSchema.partial();

export const inventoryItemSummarySchema = inventoryItemSchema.extend({
  totalValue: z.number().nullable(),
  lowStock: z.boolean()
});

export const inventoryTransactionSchema = z.object({
  id: z.string().cuid(),
  inventoryItemId: z.string().cuid(),
  type: inventoryTransactionTypeSchema,
  quantity: z.number(),
  quantityAfter: z.number(),
  referenceType: z.string().nullable(),
  referenceId: z.string().nullable(),
  unitCost: z.number().nullable(),
  notes: z.string().nullable(),
  userId: z.string().cuid(),
  createdAt: z.string().datetime()
});

export const createInventoryTransactionSchema = z.object({
  type: inventoryTransactionTypeSchema,
  quantity: z.number(),
  unitCost: z.number().min(0).optional(),
  referenceType: z.string().max(80).optional(),
  referenceId: z.string().max(120).optional(),
  notes: z.string().max(2000).optional()
});

export const assetInventoryItemSchema = z.object({
  id: z.string().cuid(),
  assetId: z.string().cuid(),
  inventoryItemId: z.string().cuid(),
  notes: z.string().nullable(),
  recommendedQuantity: z.number().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createAssetInventoryItemSchema = z.object({
  inventoryItemId: z.string().cuid(),
  notes: z.string().max(2000).optional(),
  recommendedQuantity: z.number().min(0).optional()
});

export const projectInventoryItemSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  inventoryItemId: z.string().cuid(),
  quantityNeeded: z.number(),
  quantityAllocated: z.number(),
  budgetedUnitCost: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createProjectInventoryItemSchema = z.object({
  inventoryItemId: z.string().cuid(),
  quantityNeeded: z.number().positive(),
  budgetedUnitCost: z.number().min(0).optional(),
  notes: z.string().max(2000).optional()
});

export const updateProjectInventoryItemSchema = z.object({
  quantityNeeded: z.number().positive().optional(),
  quantityAllocated: z.number().min(0).optional(),
  budgetedUnitCost: z.number().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

export const allocateProjectInventorySchema = z.object({
  quantity: z.number().positive(),
  unitCost: z.number().min(0).optional(),
  notes: z.string().max(2000).optional()
});

export const inventoryAssetLinkDetailSchema = assetInventoryItemSchema.extend({
  inventoryItem: inventoryItemSummarySchema,
  asset: shallowAssetSchema.optional()
});

export const inventoryProjectLinkDetailSchema = projectInventoryItemSchema.extend({
  inventoryItem: inventoryItemSummarySchema,
  project: z.object({
    id: z.string().cuid(),
    name: z.string()
  }).optional(),
  quantityRemaining: z.number()
});

export const inventoryItemDetailSchema = inventoryItemSummarySchema.extend({
  transactions: z.array(inventoryTransactionSchema),
  assets: z.array(z.object({
    id: z.string().cuid(),
    assetId: z.string().cuid(),
    inventoryItemId: z.string().cuid(),
    notes: z.string().nullable(),
    recommendedQuantity: z.number().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    asset: shallowAssetSchema
  })),
  projects: z.array(z.object({
    id: z.string().cuid(),
    projectId: z.string().cuid(),
    inventoryItemId: z.string().cuid(),
    quantityNeeded: z.number(),
    quantityAllocated: z.number(),
    budgetedUnitCost: z.number().nullable(),
    notes: z.string().nullable(),
    quantityRemaining: z.number(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    project: z.object({
      id: z.string().cuid(),
      name: z.string()
    })
  }))
});

export const lowStockInventoryItemSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  name: z.string(),
  partNumber: z.string().nullable(),
  quantityOnHand: z.number(),
  reorderThreshold: z.number().nullable(),
  reorderQuantity: z.number().nullable(),
  preferredSupplier: z.string().nullable(),
  supplierUrl: z.string().nullable(),
  unitCost: z.number().nullable(),
  unit: z.string(),
  deficit: z.number()
});

export const assetDetailResponseSchema = z.object({
  asset: assetSchema,
  metrics: z.array(usageMetricResponseSchema),
  schedules: z.array(maintenanceScheduleSchema),
  recentLogs: z.array(maintenanceLogSchema),
  dueScheduleCount: z.number().int().min(0),
  overdueScheduleCount: z.number().int().min(0)
});

// ── Project Schemas ──────────────────────────────────────────────────

export const projectStatusValues = ["planning", "active", "on_hold", "completed", "cancelled"] as const;
export const projectStatusSchema = z.enum(projectStatusValues);

export const projectTaskStatusValues = ["pending", "in_progress", "completed", "skipped"] as const;
export const projectTaskStatusSchema = z.enum(projectTaskStatusValues);

export const projectSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: projectStatusSchema,
  startDate: z.string().datetime().nullable(),
  targetEndDate: z.string().datetime().nullable(),
  actualEndDate: z.string().datetime().nullable(),
  budgetAmount: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: projectStatusSchema.default("planning"),
  startDate: z.string().datetime().optional(),
  targetEndDate: z.string().datetime().optional(),
  budgetAmount: z.number().min(0).optional(),
  notes: z.string().max(5000).optional()
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  description: z.string().max(2000).nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  targetEndDate: z.string().datetime().nullable().optional(),
  budgetAmount: z.number().min(0).nullable().optional(),
  notes: z.string().max(5000).nullable().optional()
});

export const projectAssetSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  assetId: z.string().cuid(),
  role: z.string().nullable(),
  notes: z.string().nullable(),
  asset: shallowAssetSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createProjectAssetSchema = z.object({
  assetId: z.string().cuid(),
  role: z.string().max(200).optional(),
  notes: z.string().max(2000).optional()
});

export const projectTaskSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  assignedToId: z.string().cuid().nullable(),
  assignee: shallowUserSchema.nullable().default(null),
  dueDate: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  estimatedCost: z.number().nullable(),
  actualCost: z.number().nullable(),
  sortOrder: z.number().int().nullable(),
  scheduleId: z.string().cuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createProjectTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: projectTaskStatusSchema.default("pending"),
  assignedToId: z.string().cuid().optional(),
  dueDate: z.string().datetime().optional(),
  estimatedCost: z.number().min(0).optional(),
  actualCost: z.number().min(0).optional(),
  sortOrder: z.number().int().optional(),
  scheduleId: z.string().cuid().optional()
});

export const updateProjectTaskSchema = createProjectTaskSchema.partial().extend({
  description: z.string().max(2000).nullable().optional(),
  assignedToId: z.string().cuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedCost: z.number().min(0).nullable().optional(),
  actualCost: z.number().min(0).nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
  scheduleId: z.string().cuid().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional()
});

export const projectExpenseSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  description: z.string(),
  amount: z.number(),
  category: z.string().nullable(),
  date: z.string().datetime().nullable(),
  taskId: z.string().cuid().nullable(),
  serviceProviderId: z.string().cuid().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createProjectExpenseSchema = z.object({
  description: z.string().min(1).max(500),
  amount: z.number().min(0),
  category: z.string().max(120).optional(),
  date: z.string().datetime().optional(),
  taskId: z.string().cuid().optional(),
  serviceProviderId: z.string().cuid().optional(),
  notes: z.string().max(2000).optional()
});

export const updateProjectExpenseSchema = createProjectExpenseSchema.partial().extend({
  category: z.string().max(120).nullable().optional(),
  date: z.string().datetime().nullable().optional(),
  taskId: z.string().cuid().nullable().optional(),
  serviceProviderId: z.string().cuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

export const projectSummarySchema = projectSchema.extend({
  totalBudgeted: z.number().nullable(),
  totalSpent: z.number(),
  taskCount: z.number().int(),
  completedTaskCount: z.number().int(),
  percentComplete: z.number()
});

export const projectDetailSchema = projectSchema.extend({
  assets: z.array(projectAssetSchema),
  tasks: z.array(projectTaskSchema),
  expenses: z.array(projectExpenseSchema)
});

// ── Activity Log Schemas ─────────────────────────────────────────────

export const activityLogSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  userId: z.string().cuid(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime()
});

export const activityLogQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  userId: z.string().cuid().optional(),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().cuid().optional()
});

// ── Invitation Schemas ───────────────────────────────────────────────

export const invitationStatusValues = ["pending", "accepted", "expired", "revoked"] as const;
export const invitationStatusSchema = z.enum(invitationStatusValues);

export const householdInvitationSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  invitedByUserId: z.string().cuid(),
  email: z.string(),
  status: invitationStatusSchema,
  token: z.string(),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  acceptedByUserId: z.string().cuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createInvitationSchema = z.object({
  email: z.string().email().max(255),
  expirationHours: z.number().int().min(1).max(720).default(72)
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1)
});

// ── Comment Schemas ──────────────────────────────────────────────────

export const commentSchema = z.object({
  id: z.string().cuid(),
  assetId: z.string().cuid(),
  authorId: z.string().cuid(),
  author: shallowUserSchema,
  body: z.string(),
  parentCommentId: z.string().cuid().nullable(),
  editedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const threadedCommentSchema = commentSchema.extend({
  replies: z.array(commentSchema).default([])
});

export const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
  parentCommentId: z.string().cuid().optional()
});

export const updateCommentSchema = z.object({
  body: z.string().min(1).max(5000)
});

// ── Search Schemas ───────────────────────────────────────────────────

export const searchEntityTypeValues = [
  "asset",
  "schedule",
  "log",
  "project",
  "service_provider",
  "inventory_item",
  "comment"
] as const;

export const searchEntityTypeSchema = z.enum(searchEntityTypeValues);

export const searchResultSchema = z.object({
  entityType: searchEntityTypeSchema,
  entityId: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().nullable(),
  entityUrl: z.string().min(1),
  parentEntityName: z.string().nullable(),
  entityMeta: z.record(z.string(), z.unknown()).nullable()
});

export const searchResultGroupSchema = z.object({
  entityType: searchEntityTypeSchema,
  label: z.string().min(1),
  results: z.array(searchResultSchema)
});

const searchTypesInputSchema = z.union([
  z.string(),
  z.array(z.string())
]).optional();

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  types: searchTypesInputSchema.transform((value, context) => {
    if (value === undefined) {
      return undefined;
    }

    const rawValues = Array.isArray(value)
      ? value.flatMap((entry) => entry.split(","))
      : value.split(",");

    const normalized = rawValues
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (normalized.length === 0) {
      return undefined;
    }

    const parsed: Array<(typeof searchEntityTypeValues)[number]> = [];

    for (const entry of normalized) {
      const result = searchEntityTypeSchema.safeParse(entry);

      if (!result.success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["types"],
          message: `Unsupported search type: ${entry}`
        });

        return z.NEVER;
      }

      if (!parsed.includes(result.data)) {
        parsed.push(result.data);
      }
    }

    return parsed;
  })
});

export const searchResponseSchema = z.object({
  query: z.string(),
  groups: z.array(searchResultGroupSchema)
});

export type AssetCategory = z.infer<typeof assetCategorySchema>;
export type AssetVisibility = z.infer<typeof assetVisibilitySchema>;
export type HouseholdRole = z.infer<typeof householdRoleSchema>;
export type AuthSource = z.infer<typeof authSourceSchema>;
export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type TriggerType = z.infer<typeof triggerTypeSchema>;
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;
export type InventoryTransactionType = z.infer<typeof inventoryTransactionTypeSchema>;
export type ScheduleStatus = z.infer<typeof scheduleStatusSchema>;
export type PresetSource = z.infer<typeof presetSourceSchema>;
export type AssetTypeSource = z.infer<typeof assetTypeSourceSchema>;
export type AssetTransferType = z.infer<typeof assetTransferTypeSchema>;
export type AssetFieldType = z.infer<typeof assetFieldTypeSchema>;
export type CustomFieldTemplateType = z.infer<typeof customFieldTemplateTypeSchema>;
export type AssetFieldValue = z.infer<typeof assetFieldValueSchema>;
export type AssetFieldOption = z.infer<typeof assetFieldOptionSchema>;
export type AssetFieldDefinition = z.infer<typeof assetFieldDefinitionSchema>;
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
export type AssetTransfer = z.infer<typeof assetTransferSchema>;
export type CreateAssetTransferInput = z.infer<typeof createAssetTransferSchema>;
export type AssetTransferList = z.infer<typeof assetTransferListSchema>;
export type AssetTag = z.infer<typeof assetTagSchema>;
export type AssetLookupQuery = z.infer<typeof assetLookupQuerySchema>;
export type AssetLabelData = z.infer<typeof assetLabelDataSchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type UpdateHouseholdInput = z.infer<typeof updateHouseholdSchema>;
export type HouseholdSummary = z.infer<typeof householdSummarySchema>;
export type AddHouseholdMemberInput = z.infer<typeof addHouseholdMemberSchema>;
export type UpdateHouseholdMemberInput = z.infer<typeof updateHouseholdMemberSchema>;
export type HouseholdMember = z.infer<typeof householdMemberSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type SearchEntityType = z.infer<typeof searchEntityTypeSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchResultGroup = z.infer<typeof searchResultGroupSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
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

export type ShallowAsset = z.infer<typeof shallowAssetSchema>;
export type PurchaseDetails = z.infer<typeof purchaseDetailsSchema>;
export type WarrantyDetails = z.infer<typeof warrantyDetailsSchema>;
export type LocationDetails = z.infer<typeof locationDetailsSchema>;
export type InsuranceDetails = z.infer<typeof insuranceDetailsSchema>;
export type DispositionDetails = z.infer<typeof dispositionDetailsSchema>;
export type ConditionEntry = z.infer<typeof conditionEntrySchema>;
export type CreateConditionAssessmentInput = z.infer<typeof createConditionAssessmentSchema>;
export type UsageMetricEntry = z.infer<typeof usageMetricEntrySchema>;
export type CreateUsageMetricEntryInput = z.infer<typeof createUsageMetricEntrySchema>;
export type UsageProjection = z.infer<typeof usageProjectionSchema>;
export type ServiceProvider = z.infer<typeof serviceProviderSchema>;
export type CreateServiceProviderInput = z.infer<typeof createServiceProviderSchema>;
export type UpdateServiceProviderInput = z.infer<typeof updateServiceProviderSchema>;
export type MaintenanceLogPart = z.infer<typeof maintenanceLogPartSchema>;
export type CreateMaintenanceLogPartInput = z.infer<typeof createMaintenanceLogPartSchema>;
export type UpdateMaintenanceLogPartInput = z.infer<typeof updateMaintenanceLogPartSchema>;
export type PurchaseCondition = z.infer<typeof purchaseConditionSchema>;
export type DisposalMethod = z.infer<typeof disposalMethodSchema>;
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type InventoryItemSummary = z.infer<typeof inventoryItemSummarySchema>;
export type InventoryTransaction = z.infer<typeof inventoryTransactionSchema>;
export type CreateInventoryTransactionInput = z.infer<typeof createInventoryTransactionSchema>;
export type AssetInventoryItem = z.infer<typeof assetInventoryItemSchema>;
export type CreateAssetInventoryItemInput = z.infer<typeof createAssetInventoryItemSchema>;
export type ProjectInventoryItem = z.infer<typeof projectInventoryItemSchema>;
export type CreateProjectInventoryItemInput = z.infer<typeof createProjectInventoryItemSchema>;
export type UpdateProjectInventoryItemInput = z.infer<typeof updateProjectInventoryItemSchema>;
export type AllocateProjectInventoryInput = z.infer<typeof allocateProjectInventorySchema>;
export type InventoryAssetLinkDetail = z.infer<typeof inventoryAssetLinkDetailSchema>;
export type InventoryProjectLinkDetail = z.infer<typeof inventoryProjectLinkDetailSchema>;
export type InventoryItemDetail = z.infer<typeof inventoryItemDetailSchema>;
export type LowStockInventoryItem = z.infer<typeof lowStockInventoryItemSchema>;

export type ShallowUser = z.infer<typeof shallowUserSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type ProjectTaskStatus = z.infer<typeof projectTaskStatusSchema>;
export type Project = z.infer<typeof projectSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectAsset = z.infer<typeof projectAssetSchema>;
export type CreateProjectAssetInput = z.infer<typeof createProjectAssetSchema>;
export type ProjectTask = z.infer<typeof projectTaskSchema>;
export type CreateProjectTaskInput = z.infer<typeof createProjectTaskSchema>;
export type UpdateProjectTaskInput = z.infer<typeof updateProjectTaskSchema>;
export type ProjectExpense = z.infer<typeof projectExpenseSchema>;
export type CreateProjectExpenseInput = z.infer<typeof createProjectExpenseSchema>;
export type UpdateProjectExpenseInput = z.infer<typeof updateProjectExpenseSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ProjectDetail = z.infer<typeof projectDetailSchema>;
export type ActivityLog = z.infer<typeof activityLogSchema>;
export type ActivityLogQuery = z.infer<typeof activityLogQuerySchema>;
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;
export type HouseholdInvitation = z.infer<typeof householdInvitationSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type ThreadedComment = z.infer<typeof threadedCommentSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

