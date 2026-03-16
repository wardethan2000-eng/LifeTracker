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
export const inventoryTransactionTypeValues = ["purchase", "consume", "adjust", "return", "transfer", "project_supply_allocation"] as const;
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

export const projectAssetRelationshipValues = ["target", "produces", "consumes", "supports"] as const;

export const assetCategorySchema = z.enum(assetCategoryValues);
export const assetVisibilitySchema = z.enum(assetVisibilityValues);
export const householdRoleSchema = z.enum(householdRoleValues);
export const projectAssetRelationshipSchema = z.enum(projectAssetRelationshipValues);
export const authSourceSchema = z.enum(authSourceValues);
export const notificationTypeSchema = z.enum(notificationTypeValues);
export const triggerTypeSchema = z.enum(triggerTypeValues);
export const notificationChannelSchema = z.enum(notificationChannelValues);
export const notificationStatusSchema = z.enum(notificationStatusValues);
export const inventoryTransactionTypeSchema = z.enum(inventoryTransactionTypeValues);
export const inventoryItemTypeSchema = z.enum(["consumable", "equipment"]);
export const inventoryConditionStatusSchema = z.enum(["good", "fair", "needs_repair", "needs_replacement"]).nullable().optional();
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
  itemType: inventoryItemTypeSchema,
  conditionStatus: z.string().nullable(),
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
  itemType: inventoryItemTypeSchema.optional(),
  conditionStatus: z.string().max(40).nullable().optional(),
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

export const noteCategoryValues = ["research", "reference", "decision", "measurement", "general"] as const;
export const noteCategorySchema = z.enum(noteCategoryValues);

export const projectTaskStatusValues = ["pending", "in_progress", "completed", "skipped"] as const;
export const projectTaskStatusSchema = z.enum(projectTaskStatusValues);
export const projectPhaseStatusValues = ["pending", "in_progress", "completed", "skipped"] as const;
export const projectPhaseStatusSchema = z.enum(projectPhaseStatusValues);

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
  parentProjectId: z.string().cuid().nullable().default(null),
  depth: z.number().int().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const projectChildSummarySchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  status: projectStatusSchema,
  depth: z.number().int(),
  budgetAmount: z.number().nullable(),
  startDate: z.string().datetime().nullable(),
  targetEndDate: z.string().datetime().nullable(),
  taskCount: z.number().int(),
  completedTaskCount: z.number().int(),
  percentComplete: z.number().int(),
  totalSpent: z.number(),
  childProjectCount: z.number().int()
});

export const projectBreadcrumbSchema = z.object({
  id: z.string().cuid(),
  name: z.string()
});

export const projectTreeStatsSchema = z.object({
  treeBudgetTotal: z.number().nullable(),
  treeSpentTotal: z.number(),
  treeTaskCount: z.number().int(),
  treeCompletedTaskCount: z.number().int(),
  treePercentComplete: z.number().int(),
  descendantProjectCount: z.number().int()
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: projectStatusSchema.default("planning"),
  startDate: z.string().datetime().optional(),
  targetEndDate: z.string().datetime().optional(),
  budgetAmount: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
  parentProjectId: z.string().cuid().optional()
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  description: z.string().max(2000).nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  targetEndDate: z.string().datetime().nullable().optional(),
  budgetAmount: z.number().min(0).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  parentProjectId: z.string().cuid().nullable().optional()
});

export const projectAssetSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  assetId: z.string().cuid(),
  relationship: projectAssetRelationshipSchema.default("target"),
  role: z.string().nullable(),
  notes: z.string().nullable(),
  asset: shallowAssetSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createProjectAssetSchema = z.object({
  assetId: z.string().cuid(),
  relationship: projectAssetRelationshipSchema.default("target").optional(),
  role: z.string().max(200).optional(),
  notes: z.string().max(2000).optional()
});

export const updateProjectAssetSchema = z.object({
  relationship: projectAssetRelationshipSchema.optional(),
  role: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

export const projectPhaseChecklistItemSchema = z.object({
  id: z.string().cuid(),
  phaseId: z.string().cuid(),
  title: z.string(),
  isCompleted: z.boolean(),
  completedAt: z.string().datetime().nullable(),
  sortOrder: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createProjectPhaseChecklistItemSchema = z.object({
  title: z.string().min(1).max(500),
  sortOrder: z.number().int().optional()
});

export const updateProjectPhaseChecklistItemSchema = createProjectPhaseChecklistItemSchema.partial().extend({
  title: z.string().min(1).max(500).optional(),
  isCompleted: z.boolean().optional(),
  sortOrder: z.number().int().nullable().optional()
});

export const projectTaskChecklistItemSchema = z.object({
  id: z.string().cuid(),
  taskId: z.string().cuid(),
  title: z.string(),
  isCompleted: z.boolean(),
  completedAt: z.string().datetime().nullable(),
  sortOrder: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createProjectTaskChecklistItemSchema = z.object({
  title: z.string().min(1).max(500),
  sortOrder: z.number().int().optional()
});

export const updateProjectTaskChecklistItemSchema = createProjectTaskChecklistItemSchema.partial().extend({
  title: z.string().min(1).max(500).optional(),
  isCompleted: z.boolean().optional(),
  sortOrder: z.number().int().nullable().optional()
});

export const projectBudgetCategorySchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  name: z.string(),
  budgetAmount: z.number().nullable(),
  sortOrder: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createProjectBudgetCategorySchema = z.object({
  name: z.string().min(1).max(200),
  budgetAmount: z.number().min(0).optional(),
  sortOrder: z.number().int().optional(),
  notes: z.string().max(2000).optional()
});

export const updateProjectBudgetCategorySchema = createProjectBudgetCategorySchema.partial().extend({
  budgetAmount: z.number().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

export const projectPhaseSupplyInventoryItemSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  quantityOnHand: z.number(),
  unit: z.string(),
  unitCost: z.number().nullable()
});

export const projectPhaseSupplySchema = z.object({
  id: z.string().cuid(),
  phaseId: z.string().cuid(),
  name: z.string(),
  description: z.string().nullable(),
  quantityNeeded: z.number(),
  quantityOnHand: z.number(),
  unit: z.string(),
  estimatedUnitCost: z.number().nullable(),
  actualUnitCost: z.number().nullable(),
  supplier: z.string().nullable(),
  supplierUrl: z.string().nullable(),
  isProcured: z.boolean(),
  procuredAt: z.string().datetime().nullable(),
  isStaged: z.boolean(),
  stagedAt: z.string().datetime().nullable(),
  inventoryItemId: z.string().cuid().nullable(),
  inventoryItem: projectPhaseSupplyInventoryItemSchema.nullable().default(null),
  notes: z.string().nullable(),
  sortOrder: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createProjectPhaseSupplySchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  quantityNeeded: z.number().min(0),
  quantityOnHand: z.number().min(0).default(0),
  unit: z.string().max(50).default("each"),
  estimatedUnitCost: z.number().min(0).optional(),
  actualUnitCost: z.number().min(0).optional(),
  supplier: z.string().max(200).optional(),
  supplierUrl: z.string().url().max(2000).optional(),
  isProcured: z.boolean().default(false),
  isStaged: z.boolean().default(false),
  inventoryItemId: z.string().cuid().optional(),
  notes: z.string().max(2000).optional(),
  sortOrder: z.number().int().optional()
});

export const updateProjectPhaseSupplySchema = createProjectPhaseSupplySchema.partial().extend({
  description: z.string().max(2000).nullable().optional(),
  quantityOnHand: z.number().min(0).nullable().optional(),
  estimatedUnitCost: z.number().min(0).nullable().optional(),
  actualUnitCost: z.number().min(0).nullable().optional(),
  supplier: z.string().max(200).nullable().optional(),
  supplierUrl: z.string().url().max(2000).nullable().optional(),
  inventoryItemId: z.string().cuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
  procuredAt: z.string().datetime().nullable().optional(),
  stagedAt: z.string().datetime().nullable().optional()
});

export const projectPhaseSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: projectPhaseStatusSchema,
  sortOrder: z.number().int().nullable(),
  startDate: z.string().datetime().nullable(),
  targetEndDate: z.string().datetime().nullable(),
  actualEndDate: z.string().datetime().nullable(),
  budgetAmount: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createProjectPhaseSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: projectPhaseStatusSchema.default("pending"),
  sortOrder: z.number().int().optional(),
  startDate: z.string().datetime().optional(),
  targetEndDate: z.string().datetime().optional(),
  budgetAmount: z.number().min(0).optional(),
  notes: z.string().max(5000).optional()
});

export const updateProjectPhaseSchema = createProjectPhaseSchema.partial().extend({
  description: z.string().max(2000).nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  targetEndDate: z.string().datetime().nullable().optional(),
  budgetAmount: z.number().min(0).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  actualEndDate: z.string().datetime().nullable().optional()
});

export const reorderProjectPhasesSchema = z.object({
  phaseIds: z.array(z.string().cuid()).min(1)
});

export const projectTaskSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  phaseId: z.string().cuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  status: projectTaskStatusSchema,
  taskType: z.string().default("full"),
  isCompleted: z.boolean().default(false),
  assignedToId: z.string().cuid().nullable(),
  assignee: shallowUserSchema.nullable().default(null),
  dueDate: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  estimatedCost: z.number().nullable(),
  actualCost: z.number().nullable(),
  sortOrder: z.number().int().nullable(),
  scheduleId: z.string().cuid().nullable(),
  checklistItems: z.array(projectTaskChecklistItemSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createProjectTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: projectTaskStatusSchema.default("pending"),
  taskType: z.enum(["quick", "full"]).default("full").optional(),
  isCompleted: z.boolean().default(false).optional(),
  phaseId: z.string().cuid().optional(),
  assignedToId: z.string().cuid().optional(),
  dueDate: z.string().datetime().optional(),
  estimatedCost: z.number().min(0).optional(),
  actualCost: z.number().min(0).optional(),
  sortOrder: z.number().int().optional(),
  scheduleId: z.string().cuid().optional()
});

export const updateProjectTaskSchema = createProjectTaskSchema.partial().extend({
  description: z.string().max(2000).nullable().optional(),
  taskType: z.enum(["quick", "full"]).optional(),
  isCompleted: z.boolean().optional(),
  phaseId: z.string().cuid().nullable().optional(),
  assignedToId: z.string().cuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedCost: z.number().min(0).nullable().optional(),
  actualCost: z.number().min(0).nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
  scheduleId: z.string().cuid().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional()
});

export const createQuickTodoSchema = z.object({
  title: z.string().min(1).max(200),
  phaseId: z.string().cuid().optional(),
  sortOrder: z.number().int().optional()
});

export const promoteTaskSchema = z.object({
  status: projectTaskStatusSchema.optional(),
  assignedToId: z.string().cuid().optional(),
  dueDate: z.string().datetime().optional(),
  estimatedCost: z.number().min(0).optional()
});

export const projectExpenseSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  phaseId: z.string().cuid().nullable(),
  budgetCategoryId: z.string().cuid().nullable(),
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
  phaseId: z.string().cuid().optional(),
  budgetCategoryId: z.string().cuid().optional(),
  taskId: z.string().cuid().optional(),
  serviceProviderId: z.string().cuid().optional(),
  notes: z.string().max(2000).optional()
});

export const updateProjectExpenseSchema = createProjectExpenseSchema.partial().extend({
  category: z.string().max(120).nullable().optional(),
  date: z.string().datetime().nullable().optional(),
  phaseId: z.string().cuid().nullable().optional(),
  budgetCategoryId: z.string().cuid().nullable().optional(),
  taskId: z.string().cuid().nullable().optional(),
  serviceProviderId: z.string().cuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

export const projectPhaseSummarySchema = projectPhaseSchema.extend({
  taskCount: z.number().int(),
  completedTaskCount: z.number().int(),
  checklistItemCount: z.number().int(),
  completedChecklistItemCount: z.number().int(),
  supplyCount: z.number().int(),
  procuredSupplyCount: z.number().int(),
  expenseTotal: z.number()
});

export const projectPhaseProgressSchema = z.object({
  name: z.string(),
  status: z.string(),
  taskCount: z.number().int(),
  completedTaskCount: z.number().int()
});

export const projectBudgetCategorySummarySchema = projectBudgetCategorySchema.extend({
  expenseCount: z.number().int(),
  actualSpend: z.number()
});

export const projectPhaseDetailSchema = projectPhaseSummarySchema.extend({
  tasks: z.array(projectTaskSchema),
  checklistItems: z.array(projectPhaseChecklistItemSchema),
  supplies: z.array(projectPhaseSupplySchema),
  expenses: z.array(projectExpenseSchema)
});

export const projectSummarySchema = projectSchema.extend({
  totalBudgeted: z.number().nullable(),
  totalSpent: z.number(),
  taskCount: z.number().int(),
  completedTaskCount: z.number().int(),
  phaseCount: z.number().int(),
  completedPhaseCount: z.number().int(),
  percentComplete: z.number(),
  phaseProgress: z.array(projectPhaseProgressSchema).default([])
});

export const projectDetailSchema = projectSchema.extend({
  assets: z.array(projectAssetSchema),
  tasks: z.array(projectTaskSchema),
  expenses: z.array(projectExpenseSchema),
  phases: z.array(projectPhaseSummarySchema),
  budgetCategories: z.array(projectBudgetCategorySummarySchema),
  breadcrumbs: z.array(projectBreadcrumbSchema).default([]),
  childProjects: z.array(projectChildSummarySchema).default([]),
  treeStats: projectTreeStatsSchema.nullable().default(null)
});

export const projectPhaseListSchema = z.array(projectPhaseSummarySchema);
export const projectPhaseChecklistItemListSchema = z.array(projectPhaseChecklistItemSchema);
export const projectTaskChecklistItemListSchema = z.array(projectTaskChecklistItemSchema);
export const projectBudgetCategoryListSchema = z.array(projectBudgetCategorySummarySchema);
export const projectPhaseSupplyListSchema = z.array(projectPhaseSupplySchema);

export const projectShoppingListItemSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  description: z.string().nullable(),
  quantityNeeded: z.number(),
  quantityOnHand: z.number(),
  quantityRemaining: z.number(),
  unit: z.string(),
  estimatedUnitCost: z.number().nullable(),
  estimatedLineCost: z.number().nullable(),
  supplier: z.string().nullable(),
  supplierUrl: z.string().nullable(),
  inventoryItemId: z.string().cuid().nullable(),
  inventoryItem: projectPhaseSupplyInventoryItemSchema.nullable().default(null),
  phaseName: z.string(),
  phaseId: z.string().cuid(),
  projectName: z.string(),
  projectId: z.string().cuid()
});

export const projectShoppingListSupplierGroupSchema = z.object({
  supplierName: z.string(),
  supplierUrl: z.string().nullable(),
  items: z.array(projectShoppingListItemSchema),
  subtotal: z.number()
});

export const projectShoppingListSchema = z.object({
  items: z.array(projectShoppingListItemSchema),
  totalEstimatedCost: z.number(),
  supplierCount: z.number(),
  lineCount: z.number(),
  groupedBySupplier: z.array(projectShoppingListSupplierGroupSchema)
});

export const projectNoteSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  phaseId: z.string().cuid().nullable(),
  title: z.string(),
  body: z.string(),
  url: z.string().nullable(),
  category: noteCategorySchema,
  attachmentUrl: z.string().nullable(),
  attachmentName: z.string().nullable(),
  isPinned: z.boolean(),
  createdById: z.string().cuid(),
  createdBy: z.object({ id: z.string().cuid(), displayName: z.string().nullable() }).nullable().default(null),
  phaseName: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const projectNoteListSchema = z.array(projectNoteSchema);

export const createProjectNoteSchema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().default(""),
  category: noteCategorySchema.default("general"),
  url: z.string().url().max(2000).optional(),
  phaseId: z.string().cuid().optional(),
  attachmentUrl: z.string().max(2000).optional(),
  attachmentName: z.string().max(500).optional(),
  isPinned: z.boolean().default(false)
});

export const updateProjectNoteSchema = createProjectNoteSchema.partial().extend({
  title: z.string().min(1).max(300).optional(),
  body: z.string().nullable().optional(),
  url: z.string().url().max(2000).nullable().optional(),
  phaseId: z.string().cuid().nullable().optional(),
  attachmentUrl: z.string().max(2000).nullable().optional(),
  attachmentName: z.string().max(500).nullable().optional()
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
  "comment",
  "hobby"
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
export type InventoryItemType = z.infer<typeof inventoryItemTypeSchema>;
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
export type ProjectPhaseStatus = z.infer<typeof projectPhaseStatusSchema>;
export type NoteCategory = z.infer<typeof noteCategorySchema>;
export type ProjectNote = z.infer<typeof projectNoteSchema>;
export type CreateProjectNoteInput = z.infer<typeof createProjectNoteSchema>;
export type UpdateProjectNoteInput = z.infer<typeof updateProjectNoteSchema>;
export type Project = z.infer<typeof projectSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectChildSummary = z.infer<typeof projectChildSummarySchema>;
export type ProjectBreadcrumb = z.infer<typeof projectBreadcrumbSchema>;
export type ProjectTreeStats = z.infer<typeof projectTreeStatsSchema>;
export type ProjectAssetRelationship = z.infer<typeof projectAssetRelationshipSchema>;
export type ProjectAsset = z.infer<typeof projectAssetSchema>;
export type CreateProjectAssetInput = z.infer<typeof createProjectAssetSchema>;
export type UpdateProjectAssetInput = z.infer<typeof updateProjectAssetSchema>;
export type ProjectPhaseChecklistItem = z.infer<typeof projectPhaseChecklistItemSchema>;
export type CreateProjectPhaseChecklistItemInput = z.infer<typeof createProjectPhaseChecklistItemSchema>;
export type UpdateProjectPhaseChecklistItemInput = z.infer<typeof updateProjectPhaseChecklistItemSchema>;
export type ProjectTaskChecklistItem = z.infer<typeof projectTaskChecklistItemSchema>;
export type CreateProjectTaskChecklistItemInput = z.infer<typeof createProjectTaskChecklistItemSchema>;
export type UpdateProjectTaskChecklistItemInput = z.infer<typeof updateProjectTaskChecklistItemSchema>;
export type ProjectBudgetCategory = z.infer<typeof projectBudgetCategorySchema>;
export type CreateProjectBudgetCategoryInput = z.infer<typeof createProjectBudgetCategorySchema>;
export type UpdateProjectBudgetCategoryInput = z.infer<typeof updateProjectBudgetCategorySchema>;
export type ProjectPhaseSupplyInventoryItem = z.infer<typeof projectPhaseSupplyInventoryItemSchema>;
export type ProjectPhaseSupply = z.infer<typeof projectPhaseSupplySchema>;
export type CreateProjectPhaseSupplyInput = z.infer<typeof createProjectPhaseSupplySchema>;
export type UpdateProjectPhaseSupplyInput = z.infer<typeof updateProjectPhaseSupplySchema>;
export type ProjectPhase = z.infer<typeof projectPhaseSchema>;
export type ProjectPhaseSummary = z.infer<typeof projectPhaseSummarySchema>;
export type ProjectPhaseProgress = z.infer<typeof projectPhaseProgressSchema>;
export type ProjectPhaseDetail = z.infer<typeof projectPhaseDetailSchema>;
export type CreateProjectPhaseInput = z.infer<typeof createProjectPhaseSchema>;
export type UpdateProjectPhaseInput = z.infer<typeof updateProjectPhaseSchema>;
export type ReorderProjectPhasesInput = z.infer<typeof reorderProjectPhasesSchema>;
export type ProjectTask = z.infer<typeof projectTaskSchema>;
export type CreateProjectTaskInput = z.infer<typeof createProjectTaskSchema>;
export type UpdateProjectTaskInput = z.infer<typeof updateProjectTaskSchema>;
export type CreateQuickTodoInput = z.infer<typeof createQuickTodoSchema>;
export type PromoteTaskInput = z.infer<typeof promoteTaskSchema>;
export type ProjectExpense = z.infer<typeof projectExpenseSchema>;
export type CreateProjectExpenseInput = z.infer<typeof createProjectExpenseSchema>;
export type UpdateProjectExpenseInput = z.infer<typeof updateProjectExpenseSchema>;
export type ProjectBudgetCategorySummary = z.infer<typeof projectBudgetCategorySummarySchema>;
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
export type ProjectShoppingListItem = z.infer<typeof projectShoppingListItemSchema>;
export type ProjectShoppingListSupplierGroup = z.infer<typeof projectShoppingListSupplierGroupSchema>;
export type ProjectShoppingList = z.infer<typeof projectShoppingListSchema>;

export const linkPreviewFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  source: z.enum(["json-ld", "og", "meta", "html", "inferred"])
});

export const linkPreviewExtractionModeSchema = z.enum(["full", "fallback"]);

export const linkPreviewResponseSchema = z.object({
  url: z.string().url(),
  canonicalUrl: z.string().url().nullable(),
  retailer: z.string().nullable(),
  fields: z.array(linkPreviewFieldSchema),
  imageUrls: z.array(z.string().url()),
  rawTitle: z.string().nullable(),
  extractionMode: linkPreviewExtractionModeSchema.default("full"),
  warningMessage: z.string().nullable().default(null),
  fetchedAt: z.string().datetime()
});

export const linkPreviewRequestSchema = z.object({
  url: z.string().url()
});

export type LinkPreviewField = z.infer<typeof linkPreviewFieldSchema>;
export type LinkPreviewResponse = z.infer<typeof linkPreviewResponseSchema>;
export type LinkPreviewRequest = z.infer<typeof linkPreviewRequestSchema>;

// ── Barcode Lookup Schemas ───────────────────────────────────────────

export const barcodeLookupRequestSchema = z.object({
  barcode: z.string().min(1).max(100),
  barcodeFormat: z.string().max(30).optional()
});

export const barcodeLookupResultSchema = z.object({
  barcode: z.string(),
  barcodeFormat: z.string(),
  found: z.boolean(),
  productName: z.string().nullable(),
  brand: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  imageUrl: z.string().nullable(),
  cachedAt: z.string().datetime().nullable()
});

export type BarcodeLookupRequest = z.infer<typeof barcodeLookupRequestSchema>;
export type BarcodeLookupResult = z.infer<typeof barcodeLookupResultSchema>;

// ── Attachment Schemas ───────────────────────────────────────────────

export const attachmentEntityTypeValues = [
  "maintenance_log",
  "asset",
  "project_note",
  "project_expense",
  "project_phase",
  "project_task",
  "inventory_item",
] as const;

export const attachmentEntityTypeSchema = z.enum(attachmentEntityTypeValues);

export const attachmentStatusValues = ["pending", "active", "deleted"] as const;
export const attachmentStatusSchema = z.enum(attachmentStatusValues);

export const attachmentSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  uploadedById: z.string(),
  uploadedBy: shallowUserSchema.nullable().default(null),
  entityType: attachmentEntityTypeSchema,
  entityId: z.string(),
  storageKey: z.string(),
  originalFilename: z.string(),
  mimeType: z.string(),
  fileSize: z.number().int(),
  thumbnailKey: z.string().nullable(),
  ocrResult: z.record(z.string(), z.unknown()).nullable(),
  caption: z.string().nullable(),
  sortOrder: z.number().int().nullable(),
  status: attachmentStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createAttachmentUploadSchema = z.object({
  entityType: attachmentEntityTypeSchema,
  entityId: z.string().min(1),
  filename: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(255),
  fileSize: z.number().int().min(1).max(52_428_800),
  caption: z.string().max(1000).optional(),
});

export const confirmAttachmentUploadSchema = z.object({});

export const updateAttachmentSchema = z.object({
  caption: z.string().max(1000).nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
});

export const attachmentUploadResponseSchema = z.object({
  attachment: attachmentSchema,
  uploadUrl: z.string(),
});

export const attachmentListQuerySchema = z.object({
  entityType: attachmentEntityTypeSchema.optional(),
  entityId: z.string().optional(),
});

export type AttachmentEntityType = z.infer<typeof attachmentEntityTypeSchema>;
export type AttachmentStatus = z.infer<typeof attachmentStatusSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type CreateAttachmentUploadInput = z.infer<typeof createAttachmentUploadSchema>;
export type ConfirmAttachmentUploadInput = z.infer<typeof confirmAttachmentUploadSchema>;
export type UpdateAttachmentInput = z.infer<typeof updateAttachmentSchema>;
export type AttachmentUploadResponse = z.infer<typeof attachmentUploadResponseSchema>;

// ── Hobby Domain ────────────────────────────────────────────────────

// Enum schemas
export const hobbyStatusSchema = z.enum(["active", "paused", "archived"]);
export type HobbyStatus = z.infer<typeof hobbyStatusSchema>;

export const hobbySessionLifecycleModeSchema = z.enum(["binary", "pipeline"]);
export type HobbySessionLifecycleMode = z.infer<typeof hobbySessionLifecycleModeSchema>;

export const hobbyRecipeSourceTypeSchema = z.enum(["preset", "user", "imported"]);
export type HobbyRecipeSourceType = z.infer<typeof hobbyRecipeSourceTypeSchema>;

export const hobbyLogTypeSchema = z.enum(["note", "tasting", "progress", "issue"]);
export type HobbyLogType = z.infer<typeof hobbyLogTypeSchema>;

// Hobby
export const hobbySchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: hobbyStatusSchema,
  hobbyType: z.string().nullable(),
  lifecycleMode: hobbySessionLifecycleModeSchema,
  customFields: z.record(z.unknown()),
  fieldDefinitions: z.array(z.unknown()),
  notes: z.string().nullable(),
  createdById: z.string().cuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Hobby = z.infer<typeof hobbySchema>;

export const createHobbyInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: hobbyStatusSchema.optional(),
  hobbyType: z.string().max(100).optional(),
  lifecycleMode: hobbySessionLifecycleModeSchema.optional(),
  customFields: z.record(z.unknown()).optional(),
  fieldDefinitions: z.array(z.unknown()).optional(),
  notes: z.string().max(5000).optional(),
  presetKey: z.string().max(120).optional(),
});

export const updateHobbyInputSchema = createHobbyInputSchema.partial().extend({
  description: z.string().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export type CreateHobbyInput = z.infer<typeof createHobbyInputSchema>;
export type UpdateHobbyInput = z.infer<typeof updateHobbyInputSchema>;

// Hobby summary (list view)
export const hobbySummarySchema = hobbySchema.extend({
  recipeCount: z.number(),
  sessionCount: z.number(),
  activeSessionCount: z.number(),
  completedSessionCount: z.number(),
  linkedAssetCount: z.number(),
  linkedInventoryCount: z.number(),
});
export type HobbySummary = z.infer<typeof hobbySummarySchema>;

// Hobby detail (GET /hobbies/:id enriched response)
export const hobbyDetailAssetLinkSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  assetId: z.string().cuid(),
  role: z.string().nullable(),
  notes: z.string().nullable(),
  asset: z.object({ id: z.string(), name: z.string(), category: z.string() }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyDetailAssetLink = z.infer<typeof hobbyDetailAssetLinkSchema>;

export const hobbyDetailInventoryLinkSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  inventoryItemId: z.string().cuid(),
  notes: z.string().nullable(),
  inventoryItem: z.object({ id: z.string(), name: z.string(), quantityOnHand: z.number(), unit: z.string() }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyDetailInventoryLink = z.infer<typeof hobbyDetailInventoryLinkSchema>;

export const hobbyDetailProjectLinkSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  projectId: z.string().cuid(),
  notes: z.string().nullable(),
  project: z.object({ id: z.string(), name: z.string(), status: z.string() }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyDetailProjectLink = z.infer<typeof hobbyDetailProjectLinkSchema>;

export const hobbyDetailRecentSessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  startDate: z.string().nullable(),
  completedDate: z.string().nullable(),
  createdAt: z.string(),
  recipeName: z.string().nullable(),
});
export type HobbyDetailRecentSession = z.infer<typeof hobbyDetailRecentSessionSchema>;

export const hobbyDetailSchema = hobbySchema.extend({
  assetLinks: z.array(hobbyDetailAssetLinkSchema),
  inventoryLinks: z.array(hobbyDetailInventoryLinkSchema),
  projectLinks: z.array(hobbyDetailProjectLinkSchema),
  metricDefinitions: z.array(z.object({
    id: z.string().cuid(),
    hobbyId: z.string().cuid(),
    name: z.string(),
    unit: z.string(),
    description: z.string().nullable(),
    metricType: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })),
  statusPipeline: z.array(z.object({
    id: z.string().cuid(),
    hobbyId: z.string().cuid(),
    label: z.string(),
    sortOrder: z.number(),
    color: z.string().nullable(),
    isFinal: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })),
  inventoryCategories: z.array(z.object({
    id: z.string().cuid(),
    hobbyId: z.string().cuid(),
    categoryName: z.string(),
    sortOrder: z.number().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })),
  recentSessions: z.array(hobbyDetailRecentSessionSchema),
  recipeCount: z.number(),
  sessionCount: z.number(),
});
export type HobbyDetail = z.infer<typeof hobbyDetailSchema>;

// HobbyAsset (link table)
export const hobbyAssetSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  assetId: z.string().cuid(),
  role: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyAsset = z.infer<typeof hobbyAssetSchema>;

export const createHobbyAssetInputSchema = z.object({
  assetId: z.string().cuid(),
  role: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});
export const updateHobbyAssetInputSchema = createHobbyAssetInputSchema.partial().omit({ assetId: true });
export type CreateHobbyAssetInput = z.infer<typeof createHobbyAssetInputSchema>;
export type UpdateHobbyAssetInput = z.infer<typeof updateHobbyAssetInputSchema>;

// HobbyInventoryItem (link table)
export const hobbyInventoryItemSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  inventoryItemId: z.string().cuid(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyInventoryItem = z.infer<typeof hobbyInventoryItemSchema>;

export const createHobbyInventoryItemInputSchema = z.object({
  inventoryItemId: z.string().cuid(),
  notes: z.string().max(2000).optional(),
});
export const updateHobbyInventoryItemInputSchema = createHobbyInventoryItemInputSchema.partial().omit({ inventoryItemId: true });
export type CreateHobbyInventoryItemInput = z.infer<typeof createHobbyInventoryItemInputSchema>;
export type UpdateHobbyInventoryItemInput = z.infer<typeof updateHobbyInventoryItemInputSchema>;

// HobbyProject (link table)
export const hobbyProjectSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  projectId: z.string().cuid(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyProject = z.infer<typeof hobbyProjectSchema>;

export const createHobbyProjectInputSchema = z.object({
  projectId: z.string().cuid(),
  notes: z.string().max(2000).optional(),
});
export const updateHobbyProjectInputSchema = createHobbyProjectInputSchema.partial().omit({ projectId: true });
export type CreateHobbyProjectInput = z.infer<typeof createHobbyProjectInputSchema>;
export type UpdateHobbyProjectInput = z.infer<typeof updateHobbyProjectInputSchema>;

// HobbyInventoryCategory
export const hobbyInventoryCategorySchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  categoryName: z.string(),
  sortOrder: z.number().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyInventoryCategory = z.infer<typeof hobbyInventoryCategorySchema>;

export const createHobbyInventoryCategoryInputSchema = z.object({
  categoryName: z.string().min(1).max(200),
  sortOrder: z.number().int().optional(),
});
export const updateHobbyInventoryCategoryInputSchema = createHobbyInventoryCategoryInputSchema.partial();
export type CreateHobbyInventoryCategoryInput = z.infer<typeof createHobbyInventoryCategoryInputSchema>;
export type UpdateHobbyInventoryCategoryInput = z.infer<typeof updateHobbyInventoryCategoryInputSchema>;

// HobbySessionStatusStep
export const hobbySessionStatusStepSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  label: z.string(),
  sortOrder: z.number(),
  color: z.string().nullable(),
  isFinal: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbySessionStatusStep = z.infer<typeof hobbySessionStatusStepSchema>;

export const createHobbySessionStatusStepInputSchema = z.object({
  label: z.string().min(1).max(100),
  sortOrder: z.number().int(),
  color: z.string().max(50).optional(),
  isFinal: z.boolean().optional(),
});
export const updateHobbySessionStatusStepInputSchema = createHobbySessionStatusStepInputSchema.partial();
export type CreateHobbySessionStatusStepInput = z.infer<typeof createHobbySessionStatusStepInputSchema>;
export type UpdateHobbySessionStatusStepInput = z.infer<typeof updateHobbySessionStatusStepInputSchema>;

// HobbyRecipe
export const hobbyRecipeSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  name: z.string(),
  description: z.string().nullable(),
  sourceType: hobbyRecipeSourceTypeSchema,
  styleCategory: z.string().nullable(),
  customFields: z.record(z.unknown()),
  estimatedDuration: z.string().nullable(),
  estimatedCost: z.number().nullable(),
  yield: z.string().nullable(),
  notes: z.string().nullable(),
  isArchived: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyRecipe = z.infer<typeof hobbyRecipeSchema>;

export const createHobbyRecipeInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sourceType: hobbyRecipeSourceTypeSchema.optional(),
  styleCategory: z.string().max(200).optional(),
  customFields: z.record(z.unknown()).optional(),
  estimatedDuration: z.string().max(100).optional(),
  estimatedCost: z.number().min(0).optional(),
  yield: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
  ingredients: z.array(z.lazy(() => createHobbyRecipeIngredientInputSchema)).optional(),
  steps: z.array(z.lazy(() => createHobbyRecipeStepInputSchema)).optional(),
});

export const updateHobbyRecipeInputSchema = createHobbyRecipeInputSchema.omit({ ingredients: true, steps: true }).partial().extend({
  description: z.string().max(2000).nullable().optional(),
  styleCategory: z.string().max(200).nullable().optional(),
  estimatedDuration: z.string().max(100).nullable().optional(),
  estimatedCost: z.number().min(0).nullable().optional(),
  yield: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  isArchived: z.boolean().optional(),
});

export type CreateHobbyRecipeInput = z.infer<typeof createHobbyRecipeInputSchema>;
export type UpdateHobbyRecipeInput = z.infer<typeof updateHobbyRecipeInputSchema>;

// HobbyRecipeIngredient
export const hobbyRecipeIngredientSchema = z.object({
  id: z.string().cuid(),
  recipeId: z.string().cuid(),
  inventoryItemId: z.string().cuid().nullable(),
  name: z.string(),
  quantity: z.number(),
  unit: z.string(),
  category: z.string().nullable(),
  notes: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyRecipeIngredient = z.infer<typeof hobbyRecipeIngredientSchema>;

export const createHobbyRecipeIngredientInputSchema = z.object({
  inventoryItemId: z.string().cuid().optional(),
  name: z.string().min(1).max(200),
  quantity: z.number().min(0),
  unit: z.string().min(1).max(50),
  category: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  sortOrder: z.number().int().optional(),
});

export const updateHobbyRecipeIngredientInputSchema = createHobbyRecipeIngredientInputSchema.partial().extend({
  inventoryItemId: z.string().cuid().nullable().optional(),
  category: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type CreateHobbyRecipeIngredientInput = z.infer<typeof createHobbyRecipeIngredientInputSchema>;
export type UpdateHobbyRecipeIngredientInput = z.infer<typeof updateHobbyRecipeIngredientInputSchema>;

// HobbyRecipeStep
export const hobbyRecipeStepSchema = z.object({
  id: z.string().cuid(),
  recipeId: z.string().cuid(),
  title: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number(),
  durationMinutes: z.number().nullable(),
  stepType: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyRecipeStep = z.infer<typeof hobbyRecipeStepSchema>;

export const createHobbyRecipeStepInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  sortOrder: z.number().int().optional(),
  durationMinutes: z.number().int().min(0).optional(),
  stepType: z.string().max(50).optional(),
});

export const updateHobbyRecipeStepInputSchema = createHobbyRecipeStepInputSchema.partial().extend({
  description: z.string().max(5000).nullable().optional(),
  durationMinutes: z.number().int().min(0).nullable().optional(),
});

export type CreateHobbyRecipeStepInput = z.infer<typeof createHobbyRecipeStepInputSchema>;
export type UpdateHobbyRecipeStepInput = z.infer<typeof updateHobbyRecipeStepInputSchema>;

// HobbySession
export const hobbySessionSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  recipeId: z.string().cuid().nullable(),
  name: z.string(),
  status: z.string(),
  startDate: z.string().datetime().nullable(),
  completedDate: z.string().datetime().nullable(),
  pipelineStepId: z.string().cuid().nullable(),
  customFields: z.record(z.unknown()),
  totalCost: z.number().nullable(),
  rating: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbySession = z.infer<typeof hobbySessionSchema>;

export const createHobbySessionInputSchema = z.object({
  recipeId: z.string().cuid().optional(),
  name: z.string().min(1).max(200),
  status: z.string().max(100).optional(),
  startDate: z.string().datetime().optional(),
  customFields: z.record(z.unknown()).optional(),
  totalCost: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateHobbySessionInputSchema = createHobbySessionInputSchema.partial().extend({
  completedDate: z.string().datetime().nullable().optional(),
  totalCost: z.number().min(0).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export type CreateHobbySessionInput = z.infer<typeof createHobbySessionInputSchema>;
export type UpdateHobbySessionInput = z.infer<typeof updateHobbySessionInputSchema>;

// HobbySession summary (list view)
export const hobbySessionSummarySchema = hobbySessionSchema.extend({
  ingredientCount: z.number(),
  stepCount: z.number(),
  completedStepCount: z.number(),
  metricReadingCount: z.number(),
  logCount: z.number(),
  recipeName: z.string().nullable(),
});
export type HobbySessionSummary = z.infer<typeof hobbySessionSummarySchema>;

// HobbySessionIngredient
export const hobbySessionIngredientSchema = z.object({
  id: z.string().cuid(),
  sessionId: z.string().cuid(),
  recipeIngredientId: z.string().cuid().nullable(),
  inventoryItemId: z.string().cuid().nullable(),
  name: z.string(),
  quantityUsed: z.number(),
  unit: z.string(),
  unitCost: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbySessionIngredient = z.infer<typeof hobbySessionIngredientSchema>;

export const createHobbySessionIngredientInputSchema = z.object({
  recipeIngredientId: z.string().cuid().optional(),
  inventoryItemId: z.string().cuid().optional(),
  name: z.string().min(1).max(200),
  quantityUsed: z.number().min(0),
  unit: z.string().min(1).max(50),
  unitCost: z.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateHobbySessionIngredientInputSchema = createHobbySessionIngredientInputSchema.partial().extend({
  inventoryItemId: z.string().cuid().nullable().optional(),
  unitCost: z.number().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type CreateHobbySessionIngredientInput = z.infer<typeof createHobbySessionIngredientInputSchema>;
export type UpdateHobbySessionIngredientInput = z.infer<typeof updateHobbySessionIngredientInputSchema>;

// HobbySessionStep
export const hobbySessionStepSchema = z.object({
  id: z.string().cuid(),
  sessionId: z.string().cuid(),
  recipeStepId: z.string().cuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number(),
  isCompleted: z.boolean(),
  completedAt: z.string().datetime().nullable(),
  durationMinutes: z.number().nullable(),
  stepType: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbySessionStep = z.infer<typeof hobbySessionStepSchema>;

export const createHobbySessionStepInputSchema = z.object({
  recipeStepId: z.string().cuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  sortOrder: z.number().int().optional(),
  durationMinutes: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateHobbySessionStepInputSchema = createHobbySessionStepInputSchema.partial().extend({
  isCompleted: z.boolean().optional(),
  description: z.string().max(5000).nullable().optional(),
  durationMinutes: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type CreateHobbySessionStepInput = z.infer<typeof createHobbySessionStepInputSchema>;
export type UpdateHobbySessionStepInput = z.infer<typeof updateHobbySessionStepInputSchema>;

// HobbyMetricDefinition
export const hobbyMetricDefinitionSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  name: z.string(),
  unit: z.string(),
  description: z.string().nullable(),
  metricType: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyMetricDefinition = z.infer<typeof hobbyMetricDefinitionSchema>;

export const createHobbyMetricDefinitionInputSchema = z.object({
  name: z.string().min(1).max(200),
  unit: z.string().min(1).max(50),
  description: z.string().max(2000).optional(),
  metricType: z.string().max(50).optional(),
});

export const updateHobbyMetricDefinitionInputSchema = createHobbyMetricDefinitionInputSchema.partial().extend({
  description: z.string().max(2000).nullable().optional(),
});

export type CreateHobbyMetricDefinitionInput = z.infer<typeof createHobbyMetricDefinitionInputSchema>;
export type UpdateHobbyMetricDefinitionInput = z.infer<typeof updateHobbyMetricDefinitionInputSchema>;

// HobbyMetricReading
export const hobbyMetricReadingSchema = z.object({
  id: z.string().cuid(),
  metricDefinitionId: z.string().cuid(),
  sessionId: z.string().cuid().nullable(),
  value: z.number(),
  readingDate: z.string().datetime(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type HobbyMetricReading = z.infer<typeof hobbyMetricReadingSchema>;

export const createHobbyMetricReadingInputSchema = z.object({
  sessionId: z.string().cuid().optional(),
  value: z.number(),
  readingDate: z.string().datetime(),
  notes: z.string().max(2000).optional(),
});

export const updateHobbyMetricReadingInputSchema = createHobbyMetricReadingInputSchema.partial();

export type CreateHobbyMetricReadingInput = z.infer<typeof createHobbyMetricReadingInputSchema>;
export type UpdateHobbyMetricReadingInput = z.infer<typeof updateHobbyMetricReadingInputSchema>;

// HobbyLog
export const hobbyLogSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  sessionId: z.string().cuid().nullable(),
  title: z.string().nullable(),
  content: z.string(),
  logDate: z.string().datetime(),
  logType: hobbyLogTypeSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyLog = z.infer<typeof hobbyLogSchema>;

export const createHobbyLogInputSchema = z.object({
  sessionId: z.string().cuid().optional(),
  title: z.string().max(200).optional(),
  content: z.string().min(1).max(10000),
  logDate: z.string().datetime(),
  logType: hobbyLogTypeSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export const updateHobbyLogInputSchema = createHobbyLogInputSchema.partial().extend({
  title: z.string().max(200).nullable().optional(),
  sessionId: z.string().cuid().nullable().optional(),
});

export type CreateHobbyLogInput = z.infer<typeof createHobbyLogInputSchema>;
export type UpdateHobbyLogInput = z.infer<typeof updateHobbyLogInputSchema>;

// HobbyRecipe detail (includes nested ingredients and steps)
export const hobbyRecipeDetailSchema = hobbyRecipeSchema.extend({
  ingredients: z.array(hobbyRecipeIngredientSchema),
  steps: z.array(hobbyRecipeStepSchema),
  sessionCount: z.number(),
});
export type HobbyRecipeDetail = z.infer<typeof hobbyRecipeDetailSchema>;

// Shopping list schemas
export const hobbyRecipeShoppingListItemSchema = z.object({
  ingredientId: z.string(),
  ingredientName: z.string(),
  quantityNeeded: z.number(),
  quantityOnHand: z.number(),
  deficit: z.number(),
  unit: z.string(),
  inventoryItemId: z.string().nullable(),
  estimatedCost: z.number().nullable(),
});
export type HobbyRecipeShoppingListItem = z.infer<typeof hobbyRecipeShoppingListItemSchema>;

export const hobbyRecipeShoppingListSchema = z.object({
  recipeId: z.string(),
  recipeName: z.string(),
  items: z.array(hobbyRecipeShoppingListItemSchema),
  totalEstimatedCost: z.number().nullable(),
});
export type HobbyRecipeShoppingList = z.infer<typeof hobbyRecipeShoppingListSchema>;

// HobbySessionDetail (GET /sessions/:id enriched response)
export const hobbySessionDetailIngredientSchema = hobbySessionIngredientSchema.extend({
  inventoryItem: z.object({ id: z.string(), name: z.string(), unit: z.string(), quantityOnHand: z.number() }).nullable(),
});
export type HobbySessionDetailIngredient = z.infer<typeof hobbySessionDetailIngredientSchema>;

export const hobbySessionDetailMetricReadingSchema = z.object({
  id: z.string(),
  metricDefinitionId: z.string(),
  sessionId: z.string().nullable(),
  value: z.number(),
  readingDate: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  metricName: z.string(),
  metricUnit: z.string(),
});
export type HobbySessionDetailMetricReading = z.infer<typeof hobbySessionDetailMetricReadingSchema>;

export const hobbySessionDetailSchema = hobbySessionSchema.extend({
  recipeName: z.string().nullable(),
  ingredients: z.array(hobbySessionDetailIngredientSchema),
  steps: z.array(hobbySessionStepSchema),
  metricReadings: z.array(hobbySessionDetailMetricReadingSchema),
  logs: z.array(hobbyLogSchema),
});
export type HobbySessionDetail = z.infer<typeof hobbySessionDetailSchema>;

// ── Hobby Preset Types ───────────────────────────────────────────────

export const hobbyPresetMetricTemplateSchema = z.object({
  key: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  unit: z.string().min(1).max(40),
  metricType: z.string().max(40).default("numeric"),
  description: z.string().max(500).optional(),
});
export type HobbyPresetMetricTemplate = z.infer<typeof hobbyPresetMetricTemplateSchema>;

export const hobbyPresetPipelineStepSchema = z.object({
  label: z.string().min(1).max(80),
  sortOrder: z.number().int().min(0),
  color: z.string().max(20).optional(),
  isFinal: z.boolean().default(false),
});
export type HobbyPresetPipelineStep = z.infer<typeof hobbyPresetPipelineStepSchema>;

export const hobbyPresetRecipeFieldSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  type: z.string(),
  helpText: z.string().max(500).optional(),
  unit: z.string().max(40).optional(),
  group: z.string().max(80).optional(),
  options: z.array(z.string()).default([]),
});
export type HobbyPresetRecipeField = z.infer<typeof hobbyPresetRecipeFieldSchema>;

export const hobbyPresetRecipeTemplateSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  styleCategory: z.string().optional(),
  ingredients: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    unit: z.string(),
    category: z.string().optional(),
    notes: z.string().optional(),
  })),
  steps: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    durationMinutes: z.number().optional(),
    stepType: z.string().default("generic"),
  })),
  customFields: z.record(z.unknown()).default({}),
});
export type HobbyPresetRecipeTemplate = z.infer<typeof hobbyPresetRecipeTemplateSchema>;

export const hobbyPresetSchema = z.object({
  key: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  lifecycleMode: hobbySessionLifecycleModeSchema.default("binary"),
  tags: z.array(z.string()),
  suggestedCustomFields: z.array(presetCustomFieldTemplateSchema),
  metricTemplates: z.array(hobbyPresetMetricTemplateSchema),
  pipelineSteps: z.array(hobbyPresetPipelineStepSchema).default([]),
  inventoryCategories: z.array(z.string()),
  recipeFields: z.array(hobbyPresetRecipeFieldSchema).default([]),
  starterRecipes: z.array(hobbyPresetRecipeTemplateSchema).default([]),
  suggestedEquipment: z.array(z.string()).default([]),
  sessionStepTypes: z.array(z.string()).default([]),
});
export type HobbyPreset = z.infer<typeof hobbyPresetSchema>;

