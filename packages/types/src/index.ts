import { z } from "zod";

export * from "./analytics/comparative.js";
export * from "./analytics/compliance.js";
export * from "./analytics/hobbies.js";
export * from "./analytics/projects.js";
export * from "./dev-fixtures.js";
export * from "./report-inputs.js";

export const createOffsetPaginationQuerySchema = (
  options: {
    defaultLimit?: number;
    maxLimit?: number;
  } = {}
) => {
  const defaultLimit = options.defaultLimit ?? 25;
  const maxLimit = options.maxLimit ?? 100;

  return z.object({
    paginated: z.coerce.boolean().default(false),
    limit: z.coerce.number().int().min(1).max(maxLimit).default(defaultLimit),
    offset: z.coerce.number().int().min(0).default(0)
  });
};

export const paginationMetadataSchema = z.object({
  total: z.number().int().min(0),
  limit: z.number().int().min(1),
  offset: z.number().int().min(0),
  hasMore: z.boolean()
});

export const createOffsetPageSchema = <T extends z.ZodTypeAny>(itemSchema: T) => z.object({
  items: z.array(itemSchema),
  ...paginationMetadataSchema.shape
});

export const exportRecordSchema: z.ZodType<Record<string, unknown>> = z.record(z.string(), z.unknown());

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
export const notificationTypeValues = ["due_soon", "due", "overdue", "digest", "announcement", "inventory_low_stock", "note_reminder"] as const;
export const triggerTypeValues = ["interval", "usage", "seasonal", "compound", "one_time"] as const;
export const notificationChannelValues = ["push", "email", "digest"] as const;
export const notificationStatusValues = ["pending", "sent", "failed", "read"] as const;
export const inventoryTransactionTypeValues = ["purchase", "consume", "adjust", "correction", "return", "transfer", "project_supply_allocation"] as const;
export const inventoryPurchaseStatusValues = ["draft", "ordered", "received"] as const;
export const inventoryPurchaseSourceValues = ["reorder", "quick_restock", "manual"] as const;
export const inventoryPurchaseLineStatusValues = ["draft", "ordered", "received"] as const;
export const spaceTypeValues = ["building", "room", "area", "shelf", "cabinet", "drawer", "tub", "bin", "other"] as const;
export const spaceScanMethodValues = ["qr_scan", "manual_lookup", "direct_navigation"] as const;
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
export const assetTimelineSourceTypeValues = [
  "maintenance_log",
  "timeline_entry",
  "project_event",
  "inventory_transaction",
  "schedule_change",
  "comment",
  "condition_assessment",
  "usage_reading"
] as const;
export const commentEntityTypeValues = ["asset", "project", "hobby", "inventory_item", "idea"] as const;
export const entryEntityTypeValues = [
  "hobby",
  "hobby_series",
  "hobby_session",
  "hobby_project",
  "hobby_project_milestone",
  "hobby_collection_item",
  "project",
  "project_phase",
  "asset",
  "schedule",
  "maintenance_log",
  "inventory_item",
  "notebook",
  "idea"
] as const;
export const entryTypeValues = [
  "note",
  "observation",
  "measurement",
  "lesson",
  "decision",
  "issue",
  "milestone",
  "reference",
  "comparison"
] as const;
export const entryFlagValues = ["important", "actionable", "resolved", "pinned", "tip", "warning", "archived"] as const;
export const entrySortByValues = ["entryDate", "createdAt", "title"] as const;
export const bodyFormatValues = ["plain_text", "rich_text"] as const;
export const webhookDeliveryStatusValues = ["pending", "delivered", "failed"] as const;

export const assetCategorySchema = z.enum(assetCategoryValues);
export const assetVisibilitySchema = z.enum(assetVisibilityValues);
export const householdRoleSchema = z.enum(householdRoleValues);
export const projectAssetRelationshipSchema = z.enum(projectAssetRelationshipValues);
export const assetTimelineSourceTypeSchema = z.enum(assetTimelineSourceTypeValues);
export const commentEntityTypeSchema = z.enum(commentEntityTypeValues);
export const entryEntityTypeSchema = z.enum(entryEntityTypeValues);
export const entryTypeSchema = z.enum(entryTypeValues);
export const entryFlagSchema = z.enum(entryFlagValues);
export const entrySortBySchema = z.enum(entrySortByValues);
export const bodyFormatSchema = z.enum(bodyFormatValues);
export const webhookDeliveryStatusSchema = z.enum(webhookDeliveryStatusValues);
export const authSourceSchema = z.enum(authSourceValues);
export const notificationTypeSchema = z.enum(notificationTypeValues);
export const triggerTypeSchema = z.enum(triggerTypeValues);
export const notificationChannelSchema = z.enum(notificationChannelValues);
export const notificationStatusSchema = z.enum(notificationStatusValues);
export const inventoryTransactionTypeSchema = z.enum(inventoryTransactionTypeValues);
export const inventoryPurchaseStatusSchema = z.enum(inventoryPurchaseStatusValues);
export const inventoryPurchaseSourceSchema = z.enum(inventoryPurchaseSourceValues);
export const inventoryPurchaseLineStatusSchema = z.enum(inventoryPurchaseLineStatusValues);
export const spaceTypeSchema = z.enum(spaceTypeValues);
export const spaceScanMethodSchema = z.enum(spaceScanMethodValues);
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
  isRegulatory: z.boolean().default(false),
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

export const usageRateAnalyticsSchema = z.object({
  metricId: z.string().cuid(),
  bucketSize: z.string(),
  mean: z.number(),
  stddev: z.number(),
  buckets: z.array(z.object({
    bucketStart: z.string().datetime(),
    bucketEnd: z.string().datetime(),
    deltaValue: z.number(),
    rate: z.number(),
    entryCount: z.number(),
    insufficientData: z.boolean(),
    isAnomaly: z.boolean(),
    deviationFactor: z.number()
  }))
});

export const usageCostNormalizationSchema = z.object({
  metricId: z.string().cuid(),
  metricName: z.string(),
  metricUnit: z.string(),
  totalCost: z.number(),
  totalUsage: z.number(),
  averageCostPerUnit: z.number(),
  entries: z.array(z.object({
    cost: z.number(),
    incrementalUsage: z.number(),
    costPerUnit: z.number(),
    completedAt: z.string().datetime(),
    logTitle: z.string()
  }))
});

export const enhancedUsageProjectionSchema = z.object({
  metricId: z.string().cuid(),
  currentValue: z.number(),
  currentRate: z.number(),
  rateUnit: z.string(),
  scheduleProjections: z.array(z.object({
    scheduleId: z.string().cuid(),
    scheduleName: z.string(),
    nextDueMetricValue: z.number(),
    projectedDate: z.string().datetime().nullable(),
    daysUntil: z.number().nullable(),
    humanLabel: z.string()
  }))
});

export const householdUsageHighlightSchema = z.object({
  assetId: z.string().cuid(),
  assetName: z.string(),
  category: assetCategorySchema,
  metricCount: z.number().int().min(0),
  anomalyCount: z.number().int().min(0),
  projectedScheduleCount: z.number().int().min(0),
  nextProjectedDue: z.string().datetime().nullable(),
  metricNames: z.array(z.string())
});

export const metricCorrelationSchema = z.object({
  metricA: z.object({
    id: z.string().cuid(),
    name: z.string()
  }),
  metricB: z.object({
    id: z.string().cuid(),
    name: z.string()
  }),
  correlation: z.number(),
  meanRatio: z.number(),
  divergenceTrend: z.string(),
  ratioSeries: z.array(z.object({
    date: z.string().datetime(),
    ratio: z.number()
  }))
});

export const assetMetricCorrelationMatrixSchema = z.object({
  assetId: z.string().cuid(),
  pairs: z.array(metricCorrelationSchema)
});

export const usageRateAnalyticsListSchema = z.array(usageRateAnalyticsSchema);
export const usageCostNormalizationListSchema = z.array(usageCostNormalizationSchema);
export const enhancedUsageProjectionListSchema = z.array(enhancedUsageProjectionSchema);
export const householdUsageHighlightListSchema = z.array(householdUsageHighlightSchema);
export const metricCorrelationListSchema = z.array(metricCorrelationSchema);
export const assetMetricCorrelationMatrixListSchema = z.array(assetMetricCorrelationMatrixSchema);

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
  spaceId: z.string().cuid().nullable().optional(),
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

export const bulkArchiveAssetsSchema = z.object({
  householdId: z.string().cuid(),
  assetIds: z.array(z.string().cuid()).optional(),
  applyToAll: z.boolean().optional(),
}).refine(
  (data) => data.applyToAll === true || (data.assetIds !== undefined && data.assetIds.length >= 1),
  { message: "Either applyToAll must be true or assetIds must have at least one item." }
);

export const bulkReassignCategorySchema = z.object({
  householdId: z.string().cuid(),
  assetIds: z.array(z.string().cuid()).optional(),
  applyToAll: z.boolean().optional(),
  category: assetCategorySchema,
}).refine(
  (data) => data.applyToAll === true || (data.assetIds !== undefined && data.assetIds.length >= 1),
  { message: "Either applyToAll must be true or assetIds must have at least one item." }
);

export const bulkFailedItemSchema = z.object({
  id: z.string().optional(),
  label: z.string().nullable(),
  error: z.string()
});

export const bulkAssetOperationResultSchema = z.object({
  succeeded: z.number(),
  failed: z.array(bulkFailedItemSchema)
});

export const bulkCompleteSchedulesSchema = z.object({
  householdId: z.string().cuid(),
  scheduleIds: z.array(z.string().cuid()).min(1).max(100),
  notes: z.string().max(2000).optional()
});

export const bulkSnoozeSchedulesSchema = z.object({
  householdId: z.string().cuid(),
  scheduleIds: z.array(z.string().cuid()).min(1).max(100),
  snoozeDays: z.number().int().min(1).max(365)
});

export const bulkPauseSchedulesSchema = z.object({
  householdId: z.string().cuid(),
  scheduleIds: z.array(z.string().cuid()).min(1).max(100)
});

export const bulkScheduleOperationResultSchema = z.object({
  succeeded: z.number(),
  failed: z.array(bulkFailedItemSchema)
});

export const bulkCompleteTasksSchema = z.object({
  householdId: z.string().cuid(),
  projectId: z.string().cuid(),
  taskIds: z.array(z.string().cuid()).min(1).max(100)
});

export const bulkReassignTasksSchema = z.object({
  householdId: z.string().cuid(),
  projectId: z.string().cuid(),
  taskIds: z.array(z.string().cuid()).min(1).max(100),
  phaseId: z.string().cuid().nullable().optional(),
  assignedToId: z.string().cuid().nullable().optional()
});

export const projectStatusValues = ["planning", "active", "on_hold", "completed", "cancelled"] as const;
export const projectStatusSchema = z.enum(projectStatusValues);

export const bulkChangeProjectStatusSchema = z.object({
  householdId: z.string().cuid(),
  projectIds: z.array(z.string().cuid()).min(1).max(100),
  status: projectStatusSchema
});

export const bulkTaskOperationResultSchema = z.object({
  succeeded: z.number(),
  failed: z.array(bulkFailedItemSchema)
});

export const bulkProjectOperationResultSchema = z.object({
  succeeded: z.number(),
  failed: z.array(bulkFailedItemSchema)
});

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
  spaceId: z.string().cuid().nullable().default(null),
  spaceLocation: z.object({
    id: z.string().cuid(),
    name: z.string(),
    shortCode: z.string(),
    type: spaceTypeSchema,
    breadcrumb: z.array(z.object({ id: z.string(), name: z.string(), type: spaceTypeSchema }))
  }).nullable().default(null),
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

export const assetPageSchema = createOffsetPageSchema(assetSchema);

export const notificationPreferencesSchema = z.object({
  pauseAll: z.boolean().default(false),
  enabledChannels: z.array(notificationChannelSchema).min(1).default(["push"]),
  preferDigest: z.boolean().default(false)
});

export const dateFormatSchema = z.enum(["US", "ISO", "locale"]);
export type DateFormat = z.infer<typeof dateFormatSchema>;

export const displayPreferencesSchema = z.object({
  pageSize: z.number().int().min(10).max(100).default(25),
  dateFormat: dateFormatSchema.default("US"),
  currencyCode: z.string().length(3).default("USD")
});
export type DisplayPreferences = z.infer<typeof displayPreferencesSchema>;

export const updateDisplayPreferencesSchema = displayPreferencesSchema.partial();
export type UpdateDisplayPreferencesInput = z.infer<typeof updateDisplayPreferencesSchema>;

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
  name: z.string().min(1).max(120).optional(),
  timezone: z.string().refine(
    (tz) => { try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return true; } catch { return false; } },
    { message: "Invalid IANA timezone identifier" }
  ).optional()
});

export const householdSummarySchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  timezone: z.string().default("America/New_York"),
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
  entryId: z.string().cuid().nullable(),
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

export const householdNotificationListSchema = z.object({
  notifications: z.array(notificationSchema),
  unreadCount: z.number().int().min(0),
  nextCursor: z.string().cuid().nullable().default(null)
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
  estimatedCost: z.number().min(0).optional(),
  estimatedMinutes: z.number().int().min(0).optional(),
  isRegulatory: z.boolean().optional(),
  assignedToId: z.string().cuid().optional()
});

export const updateMaintenanceScheduleSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).optional(),
  triggerConfig: maintenanceTriggerSchema.optional(),
  notificationConfig: notificationConfigSchema.optional(),
  metricId: z.string().cuid().optional(),
  presetKey: z.string().max(160).optional(),
  estimatedCost: z.number().min(0).optional(),
  estimatedMinutes: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isRegulatory: z.boolean().optional(),
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
  estimatedCost: z.number().nullable().default(null),
  estimatedMinutes: z.number().int().nullable().default(null),
  isActive: z.boolean(),
  isRegulatory: z.boolean().default(false),
  deletedAt: z.string().datetime().nullable().default(null),
  lastCompletedAt: z.string().datetime().nullable(),
  nextDueAt: z.string().datetime().nullable(),
  nextDueMetricValue: z.number().nullable(),
  assignedToId: z.string().cuid().nullable().default(null),
  assignee: shallowUserSchema.nullable().default(null),
  status: scheduleStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const maintenanceSchedulePageSchema = createOffsetPageSchema(maintenanceScheduleSchema);

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
  applyLinkedParts: z.boolean().default(true),
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
  applyLinkedParts: z.boolean().default(true),
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
  deletedAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// ── Cost Analytics Schemas ───────────────────────────────────────

export const costByYearEntrySchema = z.object({
  year: z.string(),
  totalCost: z.number(),
  logCount: z.number().int().min(0)
});

export const costByMonthEntrySchema = z.object({
  month: z.string(),
  totalCost: z.number(),
  logCount: z.number().int().min(0)
});

export const topScheduleCostSchema = z.object({
  scheduleId: z.string().cuid(),
  scheduleName: z.string(),
  totalCost: z.number(),
  occurrences: z.number().int().min(0),
  averageCost: z.number()
});

export const assetCostSummarySchema = z.object({
  assetId: z.string().cuid(),
  assetName: z.string(),
  category: z.string(),
  lifetimeCost: z.number(),
  yearToDateCost: z.number(),
  rolling12MonthAverage: z.number(),
  costByYear: z.array(costByYearEntrySchema),
  costByMonth: z.array(costByMonthEntrySchema),
  topSchedulesByCost: z.array(topScheduleCostSchema).max(10)
});

export const assetCostPerUnitMetricSchema = z.object({
  metricId: z.string().cuid(),
  metricName: z.string(),
  metricUnit: z.string(),
  totalCost: z.number(),
  totalUsage: z.number(),
  costPerUnit: z.number().nullable()
});

export const assetCostPerUnitSchema = z.object({
  assetId: z.string().cuid(),
  metrics: z.array(assetCostPerUnitMetricSchema)
});

export const householdCategorySpendSchema = z.object({
  category: z.string(),
  categoryLabel: z.string(),
  totalCost: z.number(),
  assetCount: z.number().int().min(0),
  logCount: z.number().int().min(0)
});

export const householdAssetSpendSchema = z.object({
  assetId: z.string().cuid(),
  assetName: z.string(),
  category: z.string(),
  totalCost: z.number(),
  logCount: z.number().int().min(0)
});

export const householdTopScheduleTypeSchema = z.object({
  scheduleName: z.string(),
  totalCost: z.number(),
  occurrences: z.number().int().min(0)
});

export const householdCostDashboardSchema = z.object({
  householdId: z.string().cuid(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  totalSpend: z.number(),
  spendByCategory: z.array(householdCategorySpendSchema),
  spendByAsset: z.array(householdAssetSpendSchema),
  spendByMonth: z.array(costByMonthEntrySchema),
  topScheduleTypes: z.array(householdTopScheduleTypeSchema).max(15)
});

export const serviceProviderSpendByMonthSchema = z.object({
  month: z.string(),
  cost: z.number()
});

export const serviceProviderSpendProviderSchema = z.object({
  providerId: z.string().cuid(),
  providerName: z.string(),
  specialty: z.string().nullable(),
  totalMaintenanceCost: z.number(),
  maintenanceLogCount: z.number().int().min(0),
  totalProjectCost: z.number(),
  projectExpenseCount: z.number().int().min(0),
  totalCombinedCost: z.number(),
  firstUsed: z.string().datetime().nullable(),
  lastUsed: z.string().datetime().nullable(),
  spendByMonth: z.array(serviceProviderSpendByMonthSchema)
});

export const serviceProviderSpendSchema = z.object({
  householdId: z.string().cuid(),
  providers: z.array(serviceProviderSpendProviderSchema)
});

export const costForecastScheduleSchema = z.object({
  scheduleId: z.string().cuid(),
  scheduleName: z.string(),
  assetId: z.string().cuid(),
  assetName: z.string(),
  costPerOccurrence: z.number().nullable(),
  occurrences3m: z.number().int().min(0),
  occurrences6m: z.number().int().min(0),
  occurrences12m: z.number().int().min(0),
  cost3m: z.number(),
  cost6m: z.number(),
  cost12m: z.number()
});

export const costForecastByAssetSchema = z.object({
  assetId: z.string().cuid(),
  assetName: z.string(),
  cost3m: z.number(),
  cost6m: z.number(),
  cost12m: z.number()
});

export const costForecastSchema = z.object({
  householdId: z.string().cuid().nullable(),
  assetId: z.string().cuid().nullable(),
  total3m: z.number(),
  total6m: z.number(),
  total12m: z.number(),
  schedules: z.array(costForecastScheduleSchema),
  byAsset: z.array(costForecastByAssetSchema)
});

export const householdCostOverviewSchema = z.object({
  dashboard: householdCostDashboardSchema.nullable(),
  serviceProviderSpend: serviceProviderSpendSchema.nullable(),
  forecast: costForecastSchema.nullable()
});

export const projectBudgetAnalysisPhaseSchema = z.object({
  phaseId: z.string().cuid(),
  phaseName: z.string(),
  budgetAmount: z.number().nullable(),
  actualSpend: z.number(),
  variance: z.number()
});

export const projectBudgetAnalysisCategorySchema = z.object({
  categoryId: z.string().cuid(),
  categoryName: z.string(),
  budgetAmount: z.number().nullable(),
  actualSpend: z.number(),
  variance: z.number()
});

export const projectBudgetAnalysisSchema = z.object({
  projectId: z.string().cuid(),
  projectName: z.string(),
  totalBudget: z.number().nullable(),
  totalSpent: z.number(),
  variance: z.number(),
  variancePercent: z.number().nullable(),
  byPhase: z.array(projectBudgetAnalysisPhaseSchema),
  byCategory: z.array(projectBudgetAnalysisCategorySchema),
  burnRate: z.number().nullable(),
  projectedTotalAtBurnRate: z.number().nullable()
});

// ── Schedule Compliance Analytics Schemas ───────────────────────

export const scheduleComplianceOverviewSchema = z.object({
  totalCompletions: z.number().int().min(0),
  onTimeCompletions: z.number().int().min(0),
  lateCompletions: z.number().int().min(0),
  onTimeRate: z.number().min(0).max(1),
  averageDaysOverdue: z.number().nullable(),
  currentOverdueCount: z.number().int().min(0),
  currentDueCount: z.number().int().min(0)
});

export const complianceTrendPointSchema = z.object({
  month: z.string(),
  totalCompletions: z.number().int().min(0),
  onTimeCompletions: z.number().int().min(0),
  lateCompletions: z.number().int().min(0),
  onTimeRate: z.number().min(0).max(1),
  overdueAtEndOfMonth: z.number().int().min(0)
});

export const categoryAdherenceSchema = z.object({
  category: z.string(),
  categoryLabel: z.string(),
  totalCompletions: z.number().int().min(0),
  onTimeCompletions: z.number().int().min(0),
  onTimeRate: z.number().min(0).max(1),
  averageDaysOverdue: z.number().nullable(),
  activeScheduleCount: z.number().int().min(0),
  currentOverdueCount: z.number().int().min(0)
});

export const assetAdherenceSchema = z.object({
  assetId: z.string(),
  assetName: z.string(),
  category: z.string(),
  totalCompletions: z.number().int().min(0),
  onTimeCompletions: z.number().int().min(0),
  onTimeRate: z.number().min(0).max(1),
  averageDaysOverdue: z.number().nullable(),
  currentOverdueCount: z.number().int().min(0)
});

export const memberAdherenceSchema = z.object({
  userId: z.string(),
  displayName: z.string().nullable(),
  totalCompletions: z.number().int().min(0),
  onTimeCompletions: z.number().int().min(0),
  onTimeRate: z.number().min(0).max(1)
});

export const scheduleComplianceDashboardSchema = z.object({
  overview: scheduleComplianceOverviewSchema,
  trend: z.array(complianceTrendPointSchema),
  byCategory: z.array(categoryAdherenceSchema),
  byAsset: z.array(assetAdherenceSchema),
  byMember: z.array(memberAdherenceSchema),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime()
});

// ── Inventory Schemas ───────────────────────────────────────────────

export const inventoryItemSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  scanTag: z.string().nullable().default(null),
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
  imageUrl: z.string().nullable(),
  expiresAt: z.string().datetime().nullable().default(null),
  deletedAt: z.string().datetime().nullable().default(null),
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
  notes: z.string().max(4000).optional(),
  imageUrl: z.string().url().max(1000).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional()
});

export const updateInventoryItemSchema = createInventoryItemSchema.partial();

export const bulkDeleteInventoryItemsSchema = z.object({
  itemIds: z.array(z.string().cuid()).min(1).max(100)
});

export const bulkAdjustInventoryItemsSchema = z.object({
  adjustments: z.array(z.object({
    inventoryItemId: z.string().cuid(),
    newQuantity: z.number().min(0)
  })).min(1).max(100)
});

export const updateInventoryPurchaseBodySchema = z.object({
  supplierName: z.string().max(200).nullable().optional(),
  supplierUrl: z.string().url().max(1000).nullable().optional(),
  notes: z.string().max(4000).nullable().optional()
});

export type BulkDeleteInventoryItems = z.infer<typeof bulkDeleteInventoryItemsSchema>;
export type BulkAdjustInventoryItems = z.infer<typeof bulkAdjustInventoryItemsSchema>;
export type UpdateInventoryPurchaseBody = z.infer<typeof updateInventoryPurchaseBodySchema>;

export const mergeInventoryItemsSchema = z.object({
  sourceInventoryItemId: z.string().cuid()
});

export const inventoryItemSummarySchema = inventoryItemSchema.extend({
  totalValue: z.number().nullable(),
  lowStock: z.boolean()
});

export const inventoryItemListResponseSchema = z.object({
  items: z.array(inventoryItemSummarySchema),
  nextCursor: z.string().cuid().nullable()
});

export const scanResolutionAssetSchema = z.object({
  type: z.literal("asset"),
  id: z.string().cuid(),
  name: z.string(),
  url: z.string()
});

export const scanResolutionSpaceSchema = z.object({
  type: z.literal("space"),
  id: z.string().cuid(),
  name: z.string(),
  shortCode: z.string().min(4).max(6),
  url: z.string()
});

export const scanResolutionInventoryItemSchema = z.object({
  type: z.literal("inventory_item"),
  id: z.string().cuid(),
  name: z.string(),
  scanTag: z.string(),
  partNumber: z.string().nullable(),
  url: z.string()
});

export const scanResolutionResponseSchema = z.discriminatedUnion("type", [
  scanResolutionAssetSchema,
  scanResolutionSpaceSchema,
  scanResolutionInventoryItemSchema
]);

export const spaceBreadcrumbSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  type: spaceTypeSchema
});

export const scanSpaceSummarySchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  shortCode: z.string().min(4).max(6),
  scanTag: z.string().min(1),
  type: spaceTypeSchema,
  breadcrumb: z.array(spaceBreadcrumbSchema)
});

export const spaceSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  shortCode: z.string().min(4).max(6),
  scanTag: z.string().min(1),
  name: z.string(),
  type: spaceTypeSchema,
  parentSpaceId: z.string().cuid().nullable(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().default(null)
});

export const createSpaceInputSchema = z.object({
  name: z.string().min(1).max(200),
  type: spaceTypeSchema,
  parentSpaceId: z.string().cuid().optional(),
  description: z.string().max(4000).optional(),
  notes: z.string().max(8000).optional(),
  sortOrder: z.number().int().optional()
});

export const updateSpaceInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: spaceTypeSchema.optional(),
  parentSpaceId: z.string().cuid().nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  notes: z.string().max(8000).nullable().optional(),
  sortOrder: z.number().int().optional()
});

export const moveSpaceInputSchema = z.object({
  newParentSpaceId: z.string().cuid().nullable()
});

export const spaceItemActionSchema = z.enum([
  "placed",
  "removed",
  "moved_in",
  "moved_out",
  "quantity_changed"
]);

export const spaceInventoryItemSchema = z.object({
  id: z.string().cuid(),
  spaceId: z.string().cuid(),
  inventoryItemId: z.string().cuid(),
  quantity: z.number().nullable(),
  notes: z.string().nullable(),
  placedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const addSpaceItemInputSchema = z.object({
  inventoryItemId: z.string().cuid(),
  quantity: z.number().min(0).optional(),
  notes: z.string().max(2000).optional()
});

export const spaceGeneralItemSchema = z.object({
  id: z.string().cuid(),
  spaceId: z.string().cuid(),
  householdId: z.string().cuid(),
  name: z.string(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().default(null)
});

export const spaceGeneralItemInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  notes: z.string().max(8000).optional()
});

export const updateSpaceGeneralItemInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  notes: z.string().max(8000).nullable().optional()
});

export const spaceReferenceSchema = spaceSchema.extend({
  breadcrumb: z.array(spaceBreadcrumbSchema).optional(),
  itemCount: z.number().int().min(0).optional(),
  generalItemCount: z.number().int().min(0).optional(),
  totalItemCount: z.number().int().min(0).optional()
});

export const spaceInventoryLinkDetailSchema = spaceInventoryItemSchema.extend({
  inventoryItem: inventoryItemSummarySchema,
  space: spaceReferenceSchema.optional()
});

export const inventoryItemSpaceLinkSchema = spaceInventoryItemSchema.extend({
  space: spaceReferenceSchema.extend({
    breadcrumb: z.array(spaceBreadcrumbSchema).default([])
  })
});

type SpaceResponseValue = z.infer<typeof spaceSchema> & {
  parent?: z.infer<typeof spaceReferenceSchema> | null | undefined;
  children?: SpaceResponseValue[] | undefined;
  breadcrumb: Array<z.infer<typeof spaceBreadcrumbSchema>>;
  spaceItems?: Array<z.infer<typeof spaceInventoryLinkDetailSchema>> | undefined;
  generalItems?: Array<z.infer<typeof spaceGeneralItemSchema>> | undefined;
  itemCount?: number | undefined;
  generalItemCount?: number | undefined;
  totalItemCount?: number | undefined;
};

export const spaceResponseSchema: z.ZodType<SpaceResponseValue, z.ZodTypeDef, unknown> = z.lazy((): z.ZodType<SpaceResponseValue, z.ZodTypeDef, unknown> => spaceSchema.extend({
  parent: spaceReferenceSchema.nullable().optional(),
  children: z.array(spaceResponseSchema).optional(),
  breadcrumb: z.array(spaceBreadcrumbSchema),
  spaceItems: z.array(spaceInventoryLinkDetailSchema).optional(),
  generalItems: z.array(spaceGeneralItemSchema).optional(),
  itemCount: z.number().int().min(0).optional(),
  generalItemCount: z.number().int().min(0).optional(),
  totalItemCount: z.number().int().min(0).optional()
}));

export const spaceListResponseSchema = z.object({
  items: z.array(spaceResponseSchema),
  nextCursor: z.string().cuid().nullable()
});

export const spaceContentsResponseSchema = z.object({
  inventoryItems: z.array(spaceInventoryLinkDetailSchema),
  generalItems: z.array(spaceGeneralItemSchema),
  childSpaces: z.object({
    count: z.number().int().min(0),
    names: z.array(z.string())
  })
});

export const spaceItemHistoryEntrySchema = z.object({
  id: z.string().cuid(),
  spaceId: z.string().cuid(),
  inventoryItemId: z.string().cuid().nullable(),
  generalItemName: z.string().nullable(),
  householdId: z.string().cuid(),
  action: spaceItemActionSchema,
  quantity: z.number().nullable(),
  previousQuantity: z.number().nullable(),
  performedBy: z.string().cuid().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  itemName: z.string().min(1),
  itemDeleted: z.boolean(),
  entityUrl: z.string().nullable(),
  space: spaceReferenceSchema.extend({
    breadcrumb: z.array(spaceBreadcrumbSchema).default([])
  }),
  actor: shallowUserSchema.nullable().default(null)
});

export const spaceItemHistoryListResponseSchema = z.object({
  items: z.array(spaceItemHistoryEntrySchema),
  nextCursor: z.string().cuid().nullable()
});

export const spaceUtilizationEntrySchema = z.object({
  spaceId: z.string().cuid(),
  shortCode: z.string().min(4).max(6),
  name: z.string(),
  type: spaceTypeSchema,
  breadcrumb: z.array(spaceBreadcrumbSchema),
  itemCount: z.number().int().min(0),
  generalItemCount: z.number().int().min(0),
  totalItemCount: z.number().int().min(0),
  lastActivityAt: z.string().datetime().nullable(),
  isEmpty: z.boolean()
});

export const spaceUtilizationListSchema = z.array(spaceUtilizationEntrySchema);

export const spaceRecentScanEntrySchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  spaceId: z.string().cuid(),
  userId: z.string().cuid(),
  scannedAt: z.string().datetime(),
  method: spaceScanMethodSchema,
  space: spaceReferenceSchema.extend({
    breadcrumb: z.array(spaceBreadcrumbSchema).default([])
  }),
  actor: shallowUserSchema
});

export const spaceRecentScanListSchema = z.array(spaceRecentScanEntrySchema);

export const spaceOrphanCountSchema = z.object({
  count: z.number().int().min(0)
});

export const importSpaceRowSchema = z.object({
  name: z.string().min(1).max(200),
  type: spaceTypeSchema,
  parentName: z.string().max(200).optional(),
  parentShortCode: z.string().min(4).max(6).optional(),
  description: z.string().max(4000).optional(),
  notes: z.string().max(8000).optional()
});

export const importSpacesSchema = z.object({
  spaces: z.array(importSpaceRowSchema).min(1).max(500)
});

export const importSpacesResultSchema = z.object({
  created: z.number().int().min(0),
  updated: z.number().int().min(0),
  errors: z.array(z.object({
    index: z.number().int().min(0),
    message: z.string()
  }))
});

export const inventoryItemRevisionValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const inventoryItemRevisionChangeSchema = z.object({
  field: z.string(),
  label: z.string(),
  previousValue: inventoryItemRevisionValueSchema,
  nextValue: inventoryItemRevisionValueSchema
});

export const inventoryItemRevisionSchema = z.object({
  id: z.string().cuid(),
  inventoryItemId: z.string().cuid(),
  householdId: z.string().cuid(),
  userId: z.string().cuid(),
  action: z.string(),
  changes: z.array(inventoryItemRevisionChangeSchema),
  user: shallowUserSchema,
  createdAt: z.string().datetime()
});

export const inventoryItemMergeResultSchema = z.object({
  sourceInventoryItemId: z.string().cuid(),
  targetInventoryItem: inventoryItemSummarySchema,
  reassignedCounts: z.object({
    transactions: z.number().int().min(0),
    purchaseLines: z.number().int().min(0),
    assetLinks: z.number().int().min(0),
    scheduleLinks: z.number().int().min(0),
    projectLinks: z.number().int().min(0),
    hobbyLinks: z.number().int().min(0),
    maintenanceLogParts: z.number().int().min(0),
    projectPhaseSupplies: z.number().int().min(0),
    hobbyRecipeIngredients: z.number().int().min(0),
    hobbySessionIngredients: z.number().int().min(0),
    comments: z.number().int().min(0)
  })
});

export const inventoryTransactionLinkSchema = z.object({
  id: z.string().cuid(),
  type: inventoryTransactionTypeSchema,
  quantity: z.number(),
  createdAt: z.string().datetime()
});

export const inventoryTransactionReferenceLinkSchema = z.object({
  href: z.string(),
  label: z.string(),
  secondaryLabel: z.string().nullable()
});

export const inventoryTransactionSchema = z.object({
  id: z.string().cuid(),
  inventoryItemId: z.string().cuid(),
  type: inventoryTransactionTypeSchema,
  quantity: z.number(),
  quantityAfter: z.number(),
  referenceType: z.string().nullable(),
  referenceId: z.string().nullable(),
  referenceLink: inventoryTransactionReferenceLinkSchema.nullable(),
  correctionOfTransactionId: z.string().cuid().nullable(),
  correctionOfTransaction: inventoryTransactionLinkSchema.nullable(),
  correctedByTransactions: z.array(inventoryTransactionLinkSchema),
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

export const createInventoryTransactionCorrectionSchema = z.object({
  replacementQuantity: z.number(),
  notes: z.string().max(2000).optional()
});

export const inventoryTransactionQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  type: inventoryTransactionTypeSchema.optional(),
  referenceType: z.string().max(80).optional(),
  inventoryItemId: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().cuid().optional()
});

export const inventoryTransactionWithItemSchema = inventoryTransactionSchema.extend({
  itemName: z.string(),
  itemPartNumber: z.string().nullable()
});

export const inventoryTransactionListSchema = z.object({
  transactions: z.array(inventoryTransactionWithItemSchema),
  nextCursor: z.string().cuid().nullable()
});

export const inventoryTransactionCorrectionResultSchema = z.object({
  transaction: inventoryTransactionSchema,
  inventoryItem: inventoryItemSummarySchema
});

export const inventoryPurchaseLineSchema = z.object({
  id: z.string().cuid(),
  purchaseId: z.string().cuid(),
  inventoryItemId: z.string().cuid(),
  projectPhaseSupplyId: z.string().cuid().nullable().default(null),
  status: inventoryPurchaseLineStatusSchema,
  plannedQuantity: z.number(),
  orderedQuantity: z.number().nullable(),
  receivedQuantity: z.number().nullable(),
  unitCost: z.number().nullable(),
  notes: z.string().nullable(),
  orderedAt: z.string().datetime().nullable(),
  receivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  inventoryItem: inventoryItemSummarySchema
});

export const inventoryPurchaseSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  createdById: z.string().cuid(),
  supplierName: z.string().nullable(),
  supplierUrl: z.string().nullable(),
  source: inventoryPurchaseSourceSchema,
  status: inventoryPurchaseStatusSchema,
  notes: z.string().nullable(),
  orderedAt: z.string().datetime().nullable(),
  receivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lineCount: z.number().int().min(0),
  totalEstimatedCost: z.number().nullable(),
  lines: z.array(inventoryPurchaseLineSchema)
});

export const inventoryShoppingListSummarySchema = z.object({
  purchaseCount: z.number().int().min(0),
  supplierCount: z.number().int().min(0),
  lineCount: z.number().int().min(0),
  totalEstimatedCost: z.number().nullable(),
  purchases: z.array(inventoryPurchaseSchema)
});

export const updateInventoryPurchaseLineSchema = z.object({
  plannedQuantity: z.number().positive().optional(),
  orderedQuantity: z.number().positive().optional(),
  receivedQuantity: z.number().positive().optional(),
  unitCost: z.number().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: inventoryPurchaseLineStatusSchema.optional()
});

export const quickRestockLineSchema = z.object({
  inventoryItemId: z.string().cuid(),
  quantity: z.number().positive(),
  unitCost: z.number().min(0).optional(),
  notes: z.string().max(2000).optional()
});

export const createQuickRestockSchema = z.object({
  supplierName: z.string().max(200).optional(),
  supplierUrl: z.string().url().max(1000).optional(),
  notes: z.string().max(2000).optional(),
  receivedAt: z.string().datetime().optional(),
  items: z.array(quickRestockLineSchema).min(1).max(100)
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

export const scheduleInventoryItemSchema = z.object({
  id: z.string().cuid(),
  scheduleId: z.string().cuid(),
  inventoryItemId: z.string().cuid(),
  quantityPerService: z.number(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const scheduleInventoryLinkDetailSchema = scheduleInventoryItemSchema.extend({
  inventoryItem: inventoryItemSummarySchema
});

export const schedulePartReadinessItemSchema = z.object({
  inventoryItemId: z.string().cuid(),
  itemName: z.string(),
  itemPartNumber: z.string().nullable(),
  unit: z.string(),
  quantityNeeded: z.number(),
  quantityOnHand: z.number(),
  deficit: z.number(),
  ready: z.boolean()
});

export const schedulePartsReadinessSchema = z.object({
  scheduleId: z.string().cuid(),
  allReady: z.boolean(),
  totalLinkedItems: z.number(),
  readyCount: z.number(),
  items: z.array(schedulePartReadinessItemSchema)
});

export const bulkPartsReadinessSchema = z.object({
  schedules: z.array(schedulePartsReadinessSchema),
  summary: z.object({
    totalSchedules: z.number(),
    allReadyCount: z.number(),
    notReadyCount: z.number()
  })
});

export const createScheduleInventoryItemSchema = z.object({
  inventoryItemId: z.string().cuid(),
  quantityPerService: z.number().positive().default(1),
  notes: z.string().max(2000).optional()
});

export const updateScheduleInventoryItemSchema = z.object({
  quantityPerService: z.number().positive().optional(),
  notes: z.string().max(2000).nullable().optional()
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
  assets: z.array(assetInventoryItemSchema.extend({
    asset: shallowAssetSchema
  })),
  spaceLinks: z.array(inventoryItemSpaceLinkSchema),
  projects: z.array(projectInventoryItemSchema.extend({
    quantityRemaining: z.number(),
    project: z.object({
      id: z.string().cuid(),
      name: z.string()
    })
  })),
  hobbyLinks: z.array(z.lazy(() => hobbyLinkSummarySchema)),
  revisions: z.array(inventoryItemRevisionSchema)
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

// ── Inventory Analytics ────────────────────────────────────────────

export const inventoryItemCostTrendPointSchema = z.object({
  month: z.string(),
  averageCost: z.number(),
  totalCost: z.number(),
  quantity: z.number()
});

export const inventoryItemConsumptionSchema = z.object({
  inventoryItemId: z.string(),
  itemName: z.string(),
  partNumber: z.string().nullable(),
  category: z.string().nullable(),
  unit: z.string(),
  totalConsumed: z.number(),
  totalPurchased: z.number(),
  totalSpent: z.number(),
  totalRestockSpent: z.number(),
  transactionCount: z.number(),
  consumeTransactionCount: z.number(),
  restockTransactionCount: z.number(),
  firstTransactionDate: z.string().nullable(),
  lastTransactionDate: z.string().nullable(),
  averageConsumptionPerMonth: z.number().nullable(),
  averageUnitCost: z.number().nullable(),
  costTrend: z.array(inventoryItemCostTrendPointSchema),
  projectedDepletionDate: z.string().nullable(),
  projectedReorderDate: z.string().nullable()
});

export const assetTopPartSchema = z.object({
  partName: z.string(),
  partNumber: z.string().nullable(),
  totalQuantity: z.number(),
  totalCost: z.number(),
  occurrences: z.number(),
  averageInterval: z.number().nullable()
});

export const assetMonthlyPartsCostSchema = z.object({
  month: z.string(),
  totalCost: z.number(),
  partCount: z.number()
});

export const assetPartsConsumptionSchema = z.object({
  assetId: z.string(),
  assetName: z.string(),
  assetCategory: z.string(),
  totalPartsUsed: z.number(),
  totalPartsCost: z.number(),
  totalPartsQuantity: z.number(),
  topParts: z.array(assetTopPartSchema),
  monthlyPartsCost: z.array(assetMonthlyPartsCostSchema)
});

export const partCommonalityAssetSchema = z.object({
  assetId: z.string(),
  assetName: z.string(),
  assetCategory: z.string(),
  timesUsed: z.number(),
  totalQuantity: z.number(),
  lastUsedDate: z.string()
});

export const partCommonalitySchema = z.object({
  partName: z.string(),
  partNumber: z.string().nullable(),
  assets: z.array(partCommonalityAssetSchema),
  totalAssets: z.number(),
  totalQuantityAcrossAssets: z.number(),
  totalCostAcrossAssets: z.number()
});

export const inventoryTurnoverSchema = z.object({
  inventoryItemId: z.string(),
  itemName: z.string(),
  partNumber: z.string().nullable(),
  category: z.string().nullable(),
  unit: z.string(),
  quantityOnHand: z.number(),
  unitCost: z.number().nullable(),
  totalValue: z.number().nullable(),
  daysSinceLastTransaction: z.number().nullable(),
  daysSinceLastConsumption: z.number().nullable(),
  turnoverRate: z.number().nullable(),
  velocityCategory: z.enum(["fast", "moderate", "slow", "stale"])
});

export const householdInventoryTopConsumerSchema = z.object({
  inventoryItemId: z.string(),
  itemName: z.string(),
  totalConsumed: z.number(),
  totalSpent: z.number()
});

export const householdInventoryTopCostItemSchema = z.object({
  inventoryItemId: z.string(),
  itemName: z.string(),
  totalSpent: z.number()
});

export const householdInventoryCategoryBreakdownSchema = z.object({
  category: z.string(),
  itemCount: z.number(),
  totalValue: z.number(),
  totalSpentLast12Months: z.number()
});

export const householdInventoryMonthlySpendingSchema = z.object({
  month: z.string(),
  totalSpent: z.number(),
  transactionCount: z.number()
});

export const householdInventoryAnalyticsSchema = z.object({
  totalItems: z.number(),
  totalValue: z.number(),
  totalSpentLast30Days: z.number(),
  totalSpentLast90Days: z.number(),
  totalSpentLast12Months: z.number(),
  lowStockCount: z.number(),
  outOfStockCount: z.number(),
  staleItemCount: z.number(),
  topConsumers: z.array(householdInventoryTopConsumerSchema),
  topCostItems: z.array(householdInventoryTopCostItemSchema),
  categoryBreakdown: z.array(householdInventoryCategoryBreakdownSchema),
  monthlySpending: z.array(householdInventoryMonthlySpendingSchema)
});

export const inventoryReorderForecastSchema = z.object({
  inventoryItemId: z.string(),
  itemName: z.string(),
  partNumber: z.string().nullable(),
  quantityOnHand: z.number(),
  reorderThreshold: z.number().nullable(),
  reorderQuantity: z.number().nullable(),
  unitCost: z.number().nullable(),
  preferredSupplier: z.string().nullable(),
  supplierUrl: z.string().nullable(),
  averageConsumptionPerMonth: z.number(),
  projectedReorderDate: z.string().nullable(),
  projectedDepletionDate: z.string().nullable(),
  daysUntilReorder: z.number().nullable(),
  daysUntilDepletion: z.number().nullable(),
  estimatedReorderCost: z.number().nullable(),
  urgency: z.enum(["critical", "soon", "planned", "healthy"])
});

// Minimal project link shape for the asset detail response.
// Full projectAssetSchema (with all fields) is defined later alongside other project types.
export const assetProjectLinkSummarySchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  relationship: projectAssetRelationshipSchema,
  role: z.string().nullable(),
  notes: z.string().nullable(),
  project: z.object({
    id: z.string().cuid(),
    name: z.string(),
    status: z.string(),
    householdId: z.string().cuid()
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// Minimal inventory link shape for the asset detail response.
export const assetInventoryLinkSummarySchema = z.object({
  id: z.string().cuid(),
  assetId: z.string().cuid(),
  inventoryItemId: z.string().cuid(),
  notes: z.string().nullable(),
  recommendedQuantity: z.number().nullable(),
  inventoryItem: z.object({
    id: z.string().cuid(),
    name: z.string(),
    unit: z.string(),
    quantityOnHand: z.number()
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const assetDetailResponseSchema = z.object({
  asset: assetSchema,
  metrics: z.array(usageMetricResponseSchema),
  schedules: z.array(maintenanceScheduleSchema),
  recentLogs: z.array(maintenanceLogSchema),
  hobbyLinks: z.array(z.lazy(() => hobbyLinkSummarySchema)),
  projectLinks: z.array(assetProjectLinkSummarySchema).default([]),
  inventoryLinks: z.array(assetInventoryLinkSummarySchema).default([]),
  dueScheduleCount: z.number().int().min(0),
  overdueScheduleCount: z.number().int().min(0)
});

// ── Project Schemas ──────────────────────────────────────────────────

export const projectStatusCountSchema = z.object({
  status: projectStatusSchema,
  count: z.number().int().min(0)
});

export const noteCategoryValues = ["research", "reference", "decision", "measurement", "general"] as const;
export const noteCategorySchema = z.enum(noteCategoryValues);

export const projectTaskStatusValues = ["pending", "in_progress", "completed", "skipped"] as const;
export const projectTaskStatusSchema = z.enum(projectTaskStatusValues);
export const projectPhaseStatusValues = ["pending", "in_progress", "completed", "skipped"] as const;
export const projectPhaseStatusSchema = z.enum(projectPhaseStatusValues);

export const taskDependencyTypeValues = ["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"] as const;
export const taskDependencyTypeSchema = z.enum(taskDependencyTypeValues);

export const projectTaskDependencySchema = z.object({
  id: z.string().cuid(),
  predecessorTaskId: z.string().cuid(),
  successorTaskId: z.string().cuid(),
  dependencyType: taskDependencyTypeSchema.default("finish_to_start"),
  lagDays: z.number().int().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createProjectTaskDependencySchema = z.object({
  predecessorTaskId: z.string().cuid(),
  successorTaskId: z.string().cuid(),
  dependencyType: taskDependencyTypeSchema.default("finish_to_start").optional(),
  lagDays: z.number().int().min(0).max(365).default(0).optional()
});

export const updateProjectTaskDependencySchema = z.object({
  dependencyType: taskDependencyTypeSchema.optional(),
  lagDays: z.number().int().min(0).max(365).optional()
});

export const projectCriticalPathSchema = z.object({
  taskIds: z.array(z.string().cuid()),
  totalEstimatedHours: z.number().min(0)
});

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
  deletedAt: z.string().datetime().nullable().default(null),
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

export const projectSupplyPurchaseRequestSchema = z.object({
  purchaseId: z.string().cuid(),
  purchaseLineId: z.string().cuid(),
  purchaseStatus: inventoryPurchaseStatusSchema,
  lineStatus: inventoryPurchaseLineStatusSchema,
  plannedQuantity: z.number(),
  orderedQuantity: z.number().nullable(),
  receivedQuantity: z.number().nullable(),
  supplierName: z.string().nullable(),
  supplierUrl: z.string().nullable()
});

export const projectPhaseSupplySchema = z.object({
  id: z.string().cuid(),
  phaseId: z.string().cuid(),
  name: z.string(),
  category: z.string().nullable(),
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
  activePurchaseRequest: projectSupplyPurchaseRequestSchema.nullable().default(null),
  notes: z.string().nullable(),
  imageUrl: z.string().nullable(),
  sortOrder: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createProjectPhaseSupplySchema = z.object({
  name: z.string().min(1).max(300),
  category: z.string().max(120).optional(),
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
  imageUrl: z.string().url().max(1000).nullable().optional(),
  sortOrder: z.number().int().optional()
});

export const updateProjectPhaseSupplySchema = createProjectPhaseSupplySchema.partial().extend({
  category: z.string().max(120).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  quantityOnHand: z.number().min(0).nullable().optional(),
  estimatedUnitCost: z.number().min(0).nullable().optional(),
  actualUnitCost: z.number().min(0).nullable().optional(),
  supplier: z.string().max(200).nullable().optional(),
  supplierUrl: z.string().url().max(2000).nullable().optional(),
  inventoryItemId: z.string().cuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().max(1000).nullable().optional(),
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

export const reorderProjectPhaseSuppliesSchema = z.object({
  supplyIds: z.array(z.string().cuid()).min(1)
});

export const reorderByOrderedIdsSchema = z.object({
  orderedIds: z.array(z.string().cuid()).min(1)
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
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  estimatedCost: z.number().nullable(),
  actualCost: z.number().nullable(),
  estimatedHours: z.number().nullable(),
  actualHours: z.number().nullable(),
  sortOrder: z.number().int().nullable(),
  scheduleId: z.string().cuid().nullable(),
  predecessorTaskIds: z.array(z.string().cuid()).default([]),
  successorTaskIds: z.array(z.string().cuid()).default([]),
  blockingTaskIds: z.array(z.string().cuid()).default([]),
  isBlocked: z.boolean().default(false),
  isCriticalPath: z.boolean().default(false),
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
  estimatedHours: z.number().min(0).optional(),
  actualHours: z.number().min(0).optional(),
  sortOrder: z.number().int().optional(),
  scheduleId: z.string().cuid().optional(),
  predecessorTaskIds: z.array(z.string().cuid()).max(50).optional()
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
  estimatedHours: z.number().min(0).nullable().optional(),
  actualHours: z.number().min(0).nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
  scheduleId: z.string().cuid().nullable().optional(),
  predecessorTaskIds: z.array(z.string().cuid()).max(50).optional(),
  completedAt: z.string().datetime().nullable().optional(),
  startedAt: z.string().datetime().nullable().optional()
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
  estimatedCost: z.number().min(0).optional(),
  estimatedHours: z.number().min(0).optional()
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
  expenseTotal: z.number(),
  totalEstimatedHours: z.number().min(0),
  totalActualHours: z.number().min(0),
  remainingEstimatedHours: z.number().min(0),
  blockedTaskCount: z.number().int().min(0),
  criticalTaskCount: z.number().int().min(0)
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
  expenses: z.array(projectExpenseSchema),
  criticalPath: projectCriticalPathSchema
});

export const projectInventoryRollupSchema = z.object({
  projectId: z.string().cuid(),
  inventoryLineCount: z.number().int().min(0),
  totalInventoryNeeded: z.number().min(0),
  totalInventoryAllocated: z.number().min(0),
  totalInventoryRemaining: z.number().min(0),
  plannedInventoryCost: z.number().min(0)
});

export const projectSummarySchema = projectSchema.extend({
  totalBudgeted: z.number().nullable(),
  totalSpent: z.number(),
  taskCount: z.number().int(),
  completedTaskCount: z.number().int(),
  phaseCount: z.number().int(),
  completedPhaseCount: z.number().int(),
  percentComplete: z.number(),
  phaseProgress: z.array(projectPhaseProgressSchema).default([]),
  totalEstimatedHours: z.number().min(0),
  totalActualHours: z.number().min(0),
  remainingEstimatedHours: z.number().min(0),
  blockedTaskCount: z.number().int().min(0),
  criticalTaskCount: z.number().int().min(0)
});

export const projectSummaryPageSchema = createOffsetPageSchema(projectSummarySchema);

export const projectPortfolioItemSchema = projectSummarySchema.extend({
  inventoryLineCount: z.number().int().min(0),
  totalInventoryNeeded: z.number().int().min(0),
  totalInventoryAllocated: z.number().int().min(0),
  totalInventoryRemaining: z.number().int().min(0),
  plannedInventoryCost: z.number().min(0)
});

export const projectDetailSchema = projectSchema.extend({
  assets: z.array(projectAssetSchema),
  hobbyLinks: z.array(z.lazy(() => hobbyLinkSummarySchema)),
  tasks: z.array(projectTaskSchema),
  expenses: z.array(projectExpenseSchema),
  phases: z.array(projectPhaseSummarySchema),
  budgetCategories: z.array(projectBudgetCategorySummarySchema),
  breadcrumbs: z.array(projectBreadcrumbSchema).default([]),
  childProjects: z.array(projectChildSummarySchema).default([]),
  treeStats: projectTreeStatsSchema.nullable().default(null),
  criticalPath: projectCriticalPathSchema
});

export const projectPhaseListSchema = z.array(projectPhaseSummarySchema);
export const projectPhaseDetailListSchema = z.array(projectPhaseDetailSchema);
export const projectPhaseChecklistItemListSchema = z.array(projectPhaseChecklistItemSchema);
export const projectTaskChecklistItemListSchema = z.array(projectTaskChecklistItemSchema);
export const projectBudgetCategoryListSchema = z.array(projectBudgetCategorySummarySchema);
export const projectPhaseSupplyListSchema = z.array(projectPhaseSupplySchema);
export const projectInventoryRollupListSchema = z.array(projectInventoryRollupSchema);
export const projectPortfolioListSchema = z.array(projectPortfolioItemSchema);
export const projectPortfolioPageSchema = createOffsetPageSchema(projectPortfolioItemSchema);
export const projectStatusCountListSchema = z.array(projectStatusCountSchema);

export const projectTemplateSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  sourceProjectId: z.string().cuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  phaseCount: z.number().int().min(0),
  taskCount: z.number().int().min(0),
  assetCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const projectTemplateListSchema = z.array(projectTemplateSchema);

export const createProjectTemplateSchema = z.object({
  sourceProjectId: z.string().cuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional()
});

export const instantiateProjectTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  startDate: z.string().datetime().optional(),
  targetEndDate: z.string().datetime().optional(),
  parentProjectId: z.string().cuid().optional()
});

export const cloneProjectSchema = instantiateProjectTemplateSchema;

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
  activePurchaseRequest: projectSupplyPurchaseRequestSchema.nullable().default(null),
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

export const createProjectPurchaseRequestSchema = z.object({
  supplyIds: z.array(z.string().cuid()).min(1).max(200).optional()
});

export const projectPurchaseRequestResultSchema = z.object({
  purchaseCount: z.number().int().min(0),
  createdLineCount: z.number().int().min(0),
  reusedLineCount: z.number().int().min(0),
  skippedSupplyCount: z.number().int().min(0),
  purchases: z.array(inventoryPurchaseSchema)
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

export const projectTaskDependencyListSchema = z.array(projectTaskDependencySchema);

// ── Project Timeline Data Schemas ────────────────────────────────────

export const projectTimelineTaskSchema = z.object({
  id: z.string().cuid(),
  title: z.string(),
  status: projectTaskStatusSchema,
  dueDate: z.string().datetime().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  derivedStartDate: z.string().datetime().nullable(),
  estimatedHours: z.number().nullable(),
  assignedToId: z.string().cuid().nullable(),
  assigneeName: z.string().nullable(),
  isCriticalPath: z.boolean(),
  isBlocked: z.boolean(),
  predecessorTaskIds: z.array(z.string().cuid()).default([]),
  successorTaskIds: z.array(z.string().cuid()).default([])
});

export const projectTimelinePhaseSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  status: projectPhaseStatusSchema,
  startDate: z.string().datetime().nullable(),
  targetEndDate: z.string().datetime().nullable(),
  actualEndDate: z.string().datetime().nullable(),
  completedTaskCount: z.number().int().default(0),
  totalTaskCount: z.number().int().default(0),
  tasks: z.array(projectTimelineTaskSchema).default([])
});

// ── Project Timeline Event Schema ────────────────────────────────────

export const timelineEventTypeValues = ["task_completed", "phase_status_changed", "entry"] as const;
export const timelineEventTypeSchema = z.enum(timelineEventTypeValues);

export const projectTimelineEventSchema = z.object({
  id: z.string(),
  type: timelineEventTypeSchema,
  date: z.string().datetime(),
  title: z.string(),
  description: z.string().nullable(),
  phaseId: z.string().nullable(),
  taskId: z.string().nullable(),
  entryType: entryTypeSchema.nullable(),
  flags: z.array(entryFlagSchema).default([]),
  thumbnailUrl: z.string().nullable(),
  attachmentCount: z.number().int().default(0)
});

export const projectTimelineDependencySchema = z.object({
  id: z.string().cuid(),
  predecessorTaskId: z.string().cuid(),
  successorTaskId: z.string().cuid(),
  dependencyType: taskDependencyTypeSchema,
  lagDays: z.number().int()
});

export const projectTimelineDataSchema = z.object({
  projectId: z.string().cuid(),
  projectName: z.string(),
  scheduledPhases: z.array(projectTimelinePhaseSchema).default([]),
  unscheduledPhases: z.array(projectTimelinePhaseSchema).default([]),
  dependencies: z.array(projectTimelineDependencySchema).default([]),
  criticalPathTaskIds: z.array(z.string().cuid()).default([]),
  events: z.array(projectTimelineEventSchema).default([]),
  projectStartDate: z.string().datetime().nullable(),
  projectTargetEndDate: z.string().datetime().nullable()
});

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

export const activityLogListResponseSchema = z.object({
  entries: z.array(activityLogSchema),
  nextCursor: z.string().cuid().nullable()
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
  householdId: z.string().cuid(),
  entityType: commentEntityTypeSchema,
  entityId: z.string().cuid(),
  assetId: z.string().cuid().nullable().default(null),
  projectId: z.string().cuid().nullable().default(null),
  hobbyId: z.string().cuid().nullable().default(null),
  inventoryItemId: z.string().cuid().nullable().default(null),
  authorId: z.string().cuid(),
  author: shallowUserSchema,
  body: z.string(),
  parentCommentId: z.string().cuid().nullable(),
  editedAt: z.string().datetime().nullable(),
  deletedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const threadedCommentSchema = commentSchema.extend({
  replies: z.array(commentSchema).default([])
});

export const threadedCommentPageSchema = createOffsetPageSchema(threadedCommentSchema);

export const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
  parentCommentId: z.string().cuid().optional()
});

export const updateCommentSchema = z.object({
  body: z.string().min(1).max(5000)
});

// ── Entry Schemas ───────────────────────────────────────────────────

const normalizedEntryStringSchema = z.string().trim().min(1);
const optionalEntryTitleSchema = z.string().trim().max(500);
const entryTagSchema = normalizedEntryStringSchema.max(50);

export const entryMeasurementSchema = z.object({
  name: normalizedEntryStringSchema.max(100),
  value: z.number().finite(),
  unit: normalizedEntryStringSchema.max(50)
});

export const entryResolvedEntitySchema = z.object({
  entityType: entryEntityTypeSchema,
  entityId: z.string().min(1),
  label: z.string().min(1),
  parentEntityType: entryEntityTypeSchema.nullable().default(null),
  parentEntityId: z.string().nullable().default(null),
  parentLabel: z.string().nullable().default(null)
});

export const entrySchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  createdById: z.string().cuid(),
  title: z.string().nullable().default(null),
  body: z.string(),
  bodyFormat: bodyFormatSchema.default("plain_text"),
  entryDate: z.string().datetime(),
  entityType: entryEntityTypeSchema,
  entityId: z.string().min(1),
  entryType: entryTypeSchema,
  measurements: z.array(entryMeasurementSchema).default([]),
  tags: z.array(entryTagSchema).max(20).default([]),
  attachmentUrl: z.string().url().nullable().default(null),
  attachmentName: z.string().nullable().default(null),
  sourceType: z.string().nullable().default(null),
  sourceId: z.string().nullable().default(null),
  folderId: z.string().cuid().nullable().default(null),
  flags: z.array(entryFlagSchema).default([]),
  reminderAt: z.string().datetime().nullable().default(null),
  reminderRepeatDays: z.number().int().min(1).nullable().default(null),
  reminderUntil: z.string().datetime().nullable().default(null),
  createdBy: shallowUserSchema,
  resolvedEntity: entryResolvedEntitySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const entryListResponseSchema = z.object({
  items: z.array(entrySchema),
  nextCursor: z.string().cuid().nullable().default(null)
});

export const actionableEntryGroupSchema = z.object({
  entityType: entryEntityTypeSchema,
  items: z.array(entrySchema)
});

export const actionableEntryGroupListSchema = z.array(actionableEntryGroupSchema);

const entryFlagsInputSchema = z.array(entryFlagSchema)
  .default([])
  .transform((flags) => Array.from(new Set(flags)));

const entryTagsInputSchema = z.array(entryTagSchema)
  .max(20)
  .default([])
  .transform((tags) => Array.from(new Set(tags)));

export const createEntrySchema = z.object({
  title: optionalEntryTitleSchema.optional().nullable(),
  body: z.string().trim().min(1).max(20000),
  bodyFormat: bodyFormatSchema.default("plain_text"),
  entryDate: z.string().datetime(),
  entityType: entryEntityTypeSchema,
  entityId: z.string().trim().min(1).max(191),
  entryType: entryTypeSchema.default("note"),
  measurements: z.array(entryMeasurementSchema).default([]),
  tags: entryTagsInputSchema,
  attachmentUrl: z.string().url().max(2000).optional().nullable(),
  attachmentName: z.string().trim().max(500).optional().nullable(),
  sourceType: z.string().trim().max(120).optional().nullable(),
  sourceId: z.string().trim().max(191).optional().nullable(),
  folderId: z.string().cuid().optional().nullable(),
  flags: entryFlagsInputSchema,
  reminderAt: z.string().datetime().optional().nullable(),
  reminderRepeatDays: z.number().int().min(1).optional().nullable(),
  reminderUntil: z.string().datetime().optional().nullable()
});

export const updateEntrySchema = z.object({
  title: optionalEntryTitleSchema.optional().nullable(),
  body: z.string().trim().min(1).max(20000).optional(),
  bodyFormat: bodyFormatSchema.optional(),
  entryDate: z.string().datetime().optional(),
  entryType: entryTypeSchema.optional(),
  measurements: z.array(entryMeasurementSchema).optional(),
  tags: entryTagsInputSchema.optional(),
  attachmentUrl: z.string().url().max(2000).optional().nullable(),
  attachmentName: z.string().trim().max(500).optional().nullable(),
  folderId: z.string().cuid().optional().nullable(),
  flags: entryFlagsInputSchema.optional(),
  reminderAt: z.string().datetime().optional().nullable(),
  reminderRepeatDays: z.number().int().min(1).optional().nullable(),
  reminderUntil: z.string().datetime().optional().nullable()
});

const commaSeparatedStringsSchema = z.union([z.string(), z.array(z.string())]).optional();

const parseCommaSeparatedValues = <T extends string>(
  value: string | string[] | undefined,
  values: readonly T[],
  path: string,
  context: z.RefinementCtx
): T[] | undefined => {
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

  const parsed: T[] = [];

  for (const entry of normalized) {
    if (!values.includes(entry as T)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [path],
        message: `Unsupported value: ${entry}`
      });

      return z.NEVER;
    }

    if (!parsed.includes(entry as T)) {
      parsed.push(entry as T);
    }
  }

  return parsed;
};

const parseCommaSeparatedStrings = (
  value: string | string[] | undefined
): string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const rawValues = Array.isArray(value)
    ? value.flatMap((entry) => entry.split(","))
    : value.split(",");

  const normalized = rawValues
    .map((entry) => entry.trim())
    .filter(Boolean);

  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
};

export const entryListQuerySchema = z.object({
  entityType: entryEntityTypeSchema.optional(),
  entityId: z.string().trim().min(1).max(191).optional(),
  entryType: entryTypeSchema.optional(),
  flags: commaSeparatedStringsSchema.transform((value, context) => parseCommaSeparatedValues(value, entryFlagValues, "flags", context)),
  excludeFlags: commaSeparatedStringsSchema.transform((value, context) => parseCommaSeparatedValues(value, entryFlagValues, "excludeFlags", context)),
  tags: commaSeparatedStringsSchema.transform((value) => parseCommaSeparatedStrings(value)),
  search: z.string().trim().min(1).max(200).optional(),
  createdById: z.string().cuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  hasMeasurements: z.coerce.boolean().optional(),
  measurementName: normalizedEntryStringSchema.max(100).optional(),
  sortBy: entrySortBySchema.default("entryDate"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().cuid().optional(),
  includeArchived: z.coerce.boolean().default(false),
  folderId: z.string().cuid().optional(),
  reminderAfter: z.string().datetime().optional(),
  reminderBefore: z.string().datetime().optional(),
  hasReminder: z.coerce.boolean().optional()
}).superRefine((value, context) => {
  if ((value.entityType && !value.entityId) || (!value.entityType && value.entityId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["entityId"],
      message: "entityType and entityId must be provided together."
    });
  }
});

export const entrySurfaceQuerySchema = z.object({
  entityType: entryEntityTypeSchema,
  entityId: z.string().trim().min(1).max(191)
});

export const webhookEndpointSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  label: z.string(),
  url: z.string().url(),
  secret: z.string().nullable().default(null),
  subscribedEventTypes: z.array(z.string()).default([]),
  isActive: z.boolean(),
  deletedAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createWebhookEndpointSchema = z.object({
  label: z.string().min(1).max(120),
  url: z.string().url().max(2000),
  secret: z.string().max(200).optional(),
  subscribedEventTypes: z.array(z.string().min(1).max(160)).default(["*"]),
  isActive: z.boolean().default(true)
});

export const updateWebhookEndpointSchema = createWebhookEndpointSchema.partial();

export const domainEventSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  eventType: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime()
});

export const webhookDeliverySchema = z.object({
  id: z.string().cuid(),
  webhookEndpointId: z.string().cuid(),
  domainEventId: z.string().cuid(),
  status: webhookDeliveryStatusSchema,
  responseStatus: z.number().int().nullable().default(null),
  responseBody: z.string().nullable().default(null),
  attemptedAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// ── Asset Timeline Schemas ────────────────────────────────────────────

export const assetTimelineEntrySchema = z.object({
  id: z.string().cuid(),
  assetId: z.string().cuid(),
  createdById: z.string().cuid(),
  title: z.string(),
  description: z.string().nullable(),
  entryDate: z.string().datetime(),
  category: z.string(),
  cost: z.number().nullable(),
  vendor: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  metadata: z.unknown(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createAssetTimelineEntrySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  entryDate: z.string().datetime(),
  category: z.string().max(100).optional(),
  cost: z.number().min(0).optional(),
  vendor: z.string().max(500).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const updateAssetTimelineEntrySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  entryDate: z.string().datetime().optional(),
  category: z.string().max(100).optional(),
  cost: z.number().min(0).optional(),
  vendor: z.string().max(500).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const assetTimelinePartSchema = z.object({
  name: z.string(),
  partNumber: z.string().nullable(),
  quantity: z.number(),
  unitCost: z.number().nullable()
});

export const assetTimelineItemSchema = z.object({
  id: z.string(),
  sourceType: assetTimelineSourceTypeSchema,
  sourceId: z.string(),
  assetId: z.string().cuid(),
  title: z.string(),
  description: z.string().nullable(),
  eventDate: z.string().datetime(),
  category: z.string().nullable(),
  cost: z.number().nullable(),
  userId: z.string().nullable(),
  userName: z.string().nullable(),
  parts: z.array(assetTimelinePartSchema).optional(),
  metadata: z.unknown(),
  isEditable: z.boolean(),
  createdAt: z.string().datetime()
});

export const assetTimelineQuerySchema = z.object({
  sourceType: assetTimelineSourceTypeSchema.optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional()
});

// ── Search Schemas ───────────────────────────────────────────────────

export const searchEntityTypeValues = [
  "asset",
  "schedule",
  "log",
  "timeline_entry",
  "asset_transfer",
  "project",
  "hobby_project",
  "service_provider",
  "inventory_item",
  "space",
  "comment",
  "entry",
  "invitation",
  "hobby",
  "hobby_series",
  "hobby_collection_item",
  "historical_inventory_item",
  "idea"
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

const parseSearchEntityTypeList = (
  value: string | string[] | undefined,
  context: z.RefinementCtx,
  path: "include" | "types"
): Array<(typeof searchEntityTypeValues)[number]> | undefined => {
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
        path: [path],
        message: `Unsupported search type: ${entry}`
      });

      return z.NEVER;
    }

    if (!parsed.includes(result.data)) {
      parsed.push(result.data);
    }
  }

  return parsed;
};

const searchBooleanInputSchema = z.union([z.boolean(), z.string(), z.number()]).transform((value, context) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const normalized = value.trim().toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off", ""].includes(normalized)) {
    return false;
  }

  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: `Unsupported boolean value: ${value}`
  });

  return z.NEVER;
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  include: searchTypesInputSchema.transform((value, context) => parseSearchEntityTypeList(value, context, "include")),
  types: searchTypesInputSchema.transform((value, context) => parseSearchEntityTypeList(value, context, "types")),
  fuzzy: searchBooleanInputSchema.default(true),
  includeHistory: searchBooleanInputSchema.default(false)
});

export const searchResponseSchema = z.object({
  query: z.string(),
  groups: z.array(searchResultGroupSchema)
});

// ── Share Link Schemas ─────────────────────────────────────────────

export const shareLinkSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  assetId: z.string().cuid(),
  createdById: z.string().cuid(),
  token: z.string(),
  label: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  isRevoked: z.boolean(),
  viewCount: z.number().int(),
  lastViewedAt: z.string().datetime().nullable(),
  dateRangeStart: z.string().datetime().nullable(),
  dateRangeEnd: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const createShareLinkSchema = z.object({
  assetId: z.string().cuid(),
  label: z.string().max(200).optional(),
  expiresAt: z.string().datetime().optional(),
  dateRangeStart: z.string().datetime().optional(),
  dateRangeEnd: z.string().datetime().optional()
});

export const shareLinkListSchema = z.array(shareLinkSchema);

export const publicAssetReportSchema = z.object({
  assetName: z.string(),
  assetCategory: z.string(),
  assetMake: z.string().nullable(),
  assetModel: z.string().nullable(),
  assetYear: z.number().nullable(),
  timelineItems: z.array(assetTimelineItemSchema),
  costSummary: z.object({
    lifetimeCost: z.number(),
    logCount: z.number().int()
  }),
  generatedAt: z.string().datetime(),
  dateRangeStart: z.string().datetime().nullable(),
  dateRangeEnd: z.string().datetime().nullable()
});

export const csvExportDatasetSchema = z.enum([
  "timeline",
  "maintenance-logs",
  "schedules",
  "cost-summary",
  "inventory"
]);

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
export type AssetTimelineSourceType = z.infer<typeof assetTimelineSourceTypeSchema>;
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
export type BulkArchiveAssetsInput = z.infer<typeof bulkArchiveAssetsSchema>;
export type BulkReassignCategoryInput = z.infer<typeof bulkReassignCategorySchema>;
export type BulkFailedItem = z.infer<typeof bulkFailedItemSchema>;
export type BulkOperationResult = z.infer<typeof bulkAssetOperationResultSchema>;
export type BulkAssetOperationResult = z.infer<typeof bulkAssetOperationResultSchema>;
export type BulkCompleteSchedulesInput = z.infer<typeof bulkCompleteSchedulesSchema>;
export type BulkSnoozeSchedulesInput = z.infer<typeof bulkSnoozeSchedulesSchema>;
export type BulkPauseSchedulesInput = z.infer<typeof bulkPauseSchedulesSchema>;
export type BulkScheduleOperationResult = z.infer<typeof bulkScheduleOperationResultSchema>;
export type BulkCompleteTasksInput = z.infer<typeof bulkCompleteTasksSchema>;
export type BulkReassignTasksInput = z.infer<typeof bulkReassignTasksSchema>;
export type BulkChangeProjectStatusInput = z.infer<typeof bulkChangeProjectStatusSchema>;
export type BulkTaskOperationResult = z.infer<typeof bulkTaskOperationResultSchema>;
export type BulkProjectOperationResult = z.infer<typeof bulkProjectOperationResultSchema>;
export type BulkLogHobbySessionsInput = z.infer<typeof bulkLogHobbySessionsSchema>;
export type BulkArchiveHobbySessionsInput = z.infer<typeof bulkArchiveHobbySessionsSchema>;
export type BulkHobbySessionOperationResult = z.infer<typeof bulkHobbySessionOperationResultSchema>;
export type BulkMoveIdeasInput = z.infer<typeof bulkMoveIdeasSchema>;
export type BulkArchiveIdeasInput = z.infer<typeof bulkArchiveIdeasSchema>;
export type BulkDeleteIdeasInput = z.infer<typeof bulkDeleteIdeasSchema>;
export type BulkSetIdeaPriorityInput = z.infer<typeof bulkSetIdeaPrioritySchema>;
export type BulkIdeaOperationResult = z.infer<typeof bulkIdeaOperationResultSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type AssetPage = z.infer<typeof assetPageSchema>;
export type AssetTransfer = z.infer<typeof assetTransferSchema>;
export type CreateAssetTransferInput = z.infer<typeof createAssetTransferSchema>;
export type AssetTransferList = z.infer<typeof assetTransferListSchema>;
export type AssetTag = z.infer<typeof assetTagSchema>;
export type AssetLookupQuery = z.infer<typeof assetLookupQuerySchema>;
export type AssetLabelData = z.infer<typeof assetLabelDataSchema>;
export type ScanResolutionAsset = z.infer<typeof scanResolutionAssetSchema>;
export type ScanResolutionSpace = z.infer<typeof scanResolutionSpaceSchema>;
export type ScanResolutionInventoryItem = z.infer<typeof scanResolutionInventoryItemSchema>;
export type ScanResolutionResponse = z.infer<typeof scanResolutionResponseSchema>;
export type ScanSpaceSummary = z.infer<typeof scanSpaceSummarySchema>;
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
export type SpaceItemAction = z.infer<typeof spaceItemActionSchema>;
export type SpaceItemHistoryEntry = z.infer<typeof spaceItemHistoryEntrySchema>;
export type SpaceItemHistoryListResponse = z.infer<typeof spaceItemHistoryListResponseSchema>;
export type ShareLink = z.infer<typeof shareLinkSchema>;
export type CreateShareLinkInput = z.infer<typeof createShareLinkSchema>;
export type PublicAssetReport = z.infer<typeof publicAssetReportSchema>;
export type CsvExportDataset = z.infer<typeof csvExportDatasetSchema>;
export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type HouseholdNotificationList = z.infer<typeof householdNotificationListSchema>;
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;
export type AssetOverview = z.infer<typeof assetOverviewSchema>;
export type DueWorkItem = z.infer<typeof dueWorkItemSchema>;
export type HouseholdDashboardStats = z.infer<typeof householdDashboardStatsSchema>;
export type HouseholdDashboard = z.infer<typeof householdDashboardSchema>;
export type AssetDetailResponse = z.infer<typeof assetDetailResponseSchema>;
export type AssetProjectLinkSummary = z.infer<typeof assetProjectLinkSummarySchema>;
export type AssetInventoryLinkSummary = z.infer<typeof assetInventoryLinkSummarySchema>;
export type CreateMaintenanceScheduleInput = z.infer<typeof createMaintenanceScheduleSchema>;
export type UpdateMaintenanceScheduleInput = z.infer<typeof updateMaintenanceScheduleSchema>;
export type MaintenanceSchedule = z.infer<typeof maintenanceScheduleSchema>;
export type MaintenanceSchedulePage = z.infer<typeof maintenanceSchedulePageSchema>;
export type CreateMaintenanceLogInput = z.infer<typeof createMaintenanceLogSchema>;
export type UpdateMaintenanceLogInput = z.infer<typeof updateMaintenanceLogSchema>;
export type CompleteMaintenanceScheduleInput = z.infer<typeof completeMaintenanceScheduleSchema>;
export type MaintenanceLog = z.infer<typeof maintenanceLogSchema>;
export type AssetCostSummary = z.infer<typeof assetCostSummarySchema>;
export type AssetCostPerUnitMetric = z.infer<typeof assetCostPerUnitMetricSchema>;
export type AssetCostPerUnit = z.infer<typeof assetCostPerUnitSchema>;
export type HouseholdCategorySpend = z.infer<typeof householdCategorySpendSchema>;
export type HouseholdAssetSpend = z.infer<typeof householdAssetSpendSchema>;
export type HouseholdTopScheduleType = z.infer<typeof householdTopScheduleTypeSchema>;
export type HouseholdCostDashboard = z.infer<typeof householdCostDashboardSchema>;
export type ServiceProviderSpendByMonth = z.infer<typeof serviceProviderSpendByMonthSchema>;
export type ServiceProviderSpendProvider = z.infer<typeof serviceProviderSpendProviderSchema>;
export type ServiceProviderSpend = z.infer<typeof serviceProviderSpendSchema>;
export type CostForecastSchedule = z.infer<typeof costForecastScheduleSchema>;
export type CostForecastByAsset = z.infer<typeof costForecastByAssetSchema>;
export type CostForecast = z.infer<typeof costForecastSchema>;
export type HouseholdCostOverview = z.infer<typeof householdCostOverviewSchema>;
export type ProjectBudgetAnalysisPhase = z.infer<typeof projectBudgetAnalysisPhaseSchema>;
export type ProjectBudgetAnalysisCategory = z.infer<typeof projectBudgetAnalysisCategorySchema>;
export type ProjectBudgetAnalysis = z.infer<typeof projectBudgetAnalysisSchema>;
export type ScheduleComplianceOverview = z.infer<typeof scheduleComplianceOverviewSchema>;
export type ComplianceTrendPoint = z.infer<typeof complianceTrendPointSchema>;
export type CategoryAdherence = z.infer<typeof categoryAdherenceSchema>;
export type AssetAdherence = z.infer<typeof assetAdherenceSchema>;
export type MemberAdherence = z.infer<typeof memberAdherenceSchema>;
export type ScheduleComplianceDashboard = z.infer<typeof scheduleComplianceDashboardSchema>;

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
export type UsageRateAnalytics = z.infer<typeof usageRateAnalyticsSchema>;
export type UsageCostNormalization = z.infer<typeof usageCostNormalizationSchema>;
export type EnhancedUsageProjection = z.infer<typeof enhancedUsageProjectionSchema>;
export type HouseholdUsageHighlight = z.infer<typeof householdUsageHighlightSchema>;
export type MetricCorrelation = z.infer<typeof metricCorrelationSchema>;
export type AssetMetricCorrelationMatrix = z.infer<typeof assetMetricCorrelationMatrixSchema>;
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
export type SpaceType = z.infer<typeof spaceTypeSchema>;
export type SpaceScanMethod = z.infer<typeof spaceScanMethodSchema>;
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type Space = z.infer<typeof spaceSchema>;
export type SpaceBreadcrumb = z.infer<typeof spaceBreadcrumbSchema>;
export type CreateSpaceInput = z.infer<typeof createSpaceInputSchema>;
export type UpdateSpaceInput = z.infer<typeof updateSpaceInputSchema>;
export type MoveSpaceInput = z.infer<typeof moveSpaceInputSchema>;
export type SpaceInventoryItem = z.infer<typeof spaceInventoryItemSchema>;
export type AddSpaceItemInput = z.infer<typeof addSpaceItemInputSchema>;
export type SpaceGeneralItem = z.infer<typeof spaceGeneralItemSchema>;
export type SpaceGeneralItemInput = z.infer<typeof spaceGeneralItemInputSchema>;
export type UpdateSpaceGeneralItemInput = z.infer<typeof updateSpaceGeneralItemInputSchema>;
export type SpaceReference = z.infer<typeof spaceReferenceSchema>;
export type SpaceInventoryLinkDetail = z.infer<typeof spaceInventoryLinkDetailSchema>;
export type InventoryItemSpaceLink = z.infer<typeof inventoryItemSpaceLinkSchema>;
export type SpaceResponse = z.infer<typeof spaceResponseSchema>;
export type SpaceListResponse = z.infer<typeof spaceListResponseSchema>;
export type SpaceContentsResponse = z.infer<typeof spaceContentsResponseSchema>;
export type SpaceUtilizationEntry = z.infer<typeof spaceUtilizationEntrySchema>;
export type SpaceRecentScanEntry = z.infer<typeof spaceRecentScanEntrySchema>;
export type SpaceOrphanCount = z.infer<typeof spaceOrphanCountSchema>;
export type ImportSpaceRow = z.infer<typeof importSpaceRowSchema>;
export type ImportSpacesResult = z.infer<typeof importSpacesResultSchema>;
export type MergeInventoryItemsInput = z.infer<typeof mergeInventoryItemsSchema>;
export type InventoryItemSummary = z.infer<typeof inventoryItemSummarySchema>;
export type InventoryItemListResponse = z.infer<typeof inventoryItemListResponseSchema>;
export type InventoryItemRevisionValue = z.infer<typeof inventoryItemRevisionValueSchema>;
export type InventoryItemRevisionChange = z.infer<typeof inventoryItemRevisionChangeSchema>;
export type InventoryItemRevision = z.infer<typeof inventoryItemRevisionSchema>;
export type InventoryItemMergeResult = z.infer<typeof inventoryItemMergeResultSchema>;
export type InventoryTransaction = z.infer<typeof inventoryTransactionSchema>;
export type InventoryTransactionReferenceLink = z.infer<typeof inventoryTransactionReferenceLinkSchema>;
export type CreateInventoryTransactionInput = z.infer<typeof createInventoryTransactionSchema>;
export type CreateInventoryTransactionCorrectionInput = z.infer<typeof createInventoryTransactionCorrectionSchema>;
export type InventoryTransactionCorrectionResult = z.infer<typeof inventoryTransactionCorrectionResultSchema>;
export type InventoryPurchaseStatus = z.infer<typeof inventoryPurchaseStatusSchema>;
export type InventoryPurchaseSource = z.infer<typeof inventoryPurchaseSourceSchema>;
export type InventoryPurchaseLineStatus = z.infer<typeof inventoryPurchaseLineStatusSchema>;
export type InventoryPurchaseLine = z.infer<typeof inventoryPurchaseLineSchema>;
export type InventoryPurchase = z.infer<typeof inventoryPurchaseSchema>;
export type InventoryShoppingListSummary = z.infer<typeof inventoryShoppingListSummarySchema>;
export type UpdateInventoryPurchaseLineInput = z.infer<typeof updateInventoryPurchaseLineSchema>;
export type QuickRestockLineInput = z.infer<typeof quickRestockLineSchema>;
export type CreateQuickRestockInput = z.infer<typeof createQuickRestockSchema>;
export type InventoryItemConsumption = z.infer<typeof inventoryItemConsumptionSchema>;
export type AssetPartsConsumption = z.infer<typeof assetPartsConsumptionSchema>;
export type PartCommonality = z.infer<typeof partCommonalitySchema>;
export type InventoryTurnover = z.infer<typeof inventoryTurnoverSchema>;
export type HouseholdInventoryAnalytics = z.infer<typeof householdInventoryAnalyticsSchema>;
export type InventoryReorderForecast = z.infer<typeof inventoryReorderForecastSchema>;
export type InventoryTransactionQuery = z.infer<typeof inventoryTransactionQuerySchema>;
export type InventoryTransactionWithItem = z.infer<typeof inventoryTransactionWithItemSchema>;
export type InventoryTransactionList = z.infer<typeof inventoryTransactionListSchema>;
export type AssetInventoryItem = z.infer<typeof assetInventoryItemSchema>;
export type CreateAssetInventoryItemInput = z.infer<typeof createAssetInventoryItemSchema>;
export type ScheduleInventoryItem = z.infer<typeof scheduleInventoryItemSchema>;
export type ScheduleInventoryLinkDetail = z.infer<typeof scheduleInventoryLinkDetailSchema>;
export type SchedulePartReadinessItem = z.infer<typeof schedulePartReadinessItemSchema>;
export type SchedulePartsReadiness = z.infer<typeof schedulePartsReadinessSchema>;
export type BulkPartsReadiness = z.infer<typeof bulkPartsReadinessSchema>;
export type CreateScheduleInventoryItemInput = z.infer<typeof createScheduleInventoryItemSchema>;
export type UpdateScheduleInventoryItemInput = z.infer<typeof updateScheduleInventoryItemSchema>;
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
export type ProjectStatusCount = z.infer<typeof projectStatusCountSchema>;
export type ProjectTaskStatus = z.infer<typeof projectTaskStatusSchema>;
export type ProjectPhaseStatus = z.infer<typeof projectPhaseStatusSchema>;
export type TaskDependencyType = z.infer<typeof taskDependencyTypeSchema>;
export type ProjectTaskDependency = z.infer<typeof projectTaskDependencySchema>;
export type CreateProjectTaskDependencyInput = z.infer<typeof createProjectTaskDependencySchema>;
export type UpdateProjectTaskDependencyInput = z.infer<typeof updateProjectTaskDependencySchema>;
export type ProjectCriticalPath = z.infer<typeof projectCriticalPathSchema>;
export type ProjectTimelineTask = z.infer<typeof projectTimelineTaskSchema>;
export type ProjectTimelinePhase = z.infer<typeof projectTimelinePhaseSchema>;
export type ProjectTimelineDependency = z.infer<typeof projectTimelineDependencySchema>;
export type ProjectTimelineEvent = z.infer<typeof projectTimelineEventSchema>;
export type ProjectTimelineData = z.infer<typeof projectTimelineDataSchema>;
export type NoteCategory = z.infer<typeof noteCategorySchema>;
export type ProjectNote = z.infer<typeof projectNoteSchema>;
export type CreateProjectNoteInput = z.infer<typeof createProjectNoteSchema>;
export type UpdateProjectNoteInput = z.infer<typeof updateProjectNoteSchema>;
export type Project = z.infer<typeof projectSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectTemplate = z.infer<typeof projectTemplateSchema>;
export type ProjectTemplateList = z.infer<typeof projectTemplateListSchema>;
export type CreateProjectTemplateInput = z.infer<typeof createProjectTemplateSchema>;
export type InstantiateProjectTemplateInput = z.infer<typeof instantiateProjectTemplateSchema>;
export type CloneProjectInput = z.infer<typeof cloneProjectSchema>;
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
export type ProjectSupplyPurchaseRequest = z.infer<typeof projectSupplyPurchaseRequestSchema>;
export type ProjectPhaseSupply = z.infer<typeof projectPhaseSupplySchema>;
export type CreateProjectPhaseSupplyInput = z.infer<typeof createProjectPhaseSupplySchema>;
export type UpdateProjectPhaseSupplyInput = z.infer<typeof updateProjectPhaseSupplySchema>;
export type ReorderProjectPhaseSuppliesInput = z.infer<typeof reorderProjectPhaseSuppliesSchema>;
export type ReorderByOrderedIdsInput = z.infer<typeof reorderByOrderedIdsSchema>;
export type ProjectPhase = z.infer<typeof projectPhaseSchema>;
export type ProjectPhaseSummary = z.infer<typeof projectPhaseSummarySchema>;
export type ProjectPhaseProgress = z.infer<typeof projectPhaseProgressSchema>;
export type ProjectPhaseDetail = z.infer<typeof projectPhaseDetailSchema>;
export type ProjectInventoryRollup = z.infer<typeof projectInventoryRollupSchema>;
export type ProjectPortfolioItem = z.infer<typeof projectPortfolioItemSchema>;
export type ProjectPortfolioPage = z.infer<typeof projectPortfolioPageSchema>;
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
export type ProjectSummaryPage = z.infer<typeof projectSummaryPageSchema>;
export type ProjectDetail = z.infer<typeof projectDetailSchema>;
export type ActivityLog = z.infer<typeof activityLogSchema>;
export type ActivityLogQuery = z.infer<typeof activityLogQuerySchema>;
export type ActivityLogListResponse = z.infer<typeof activityLogListResponseSchema>;
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;
export type HouseholdInvitation = z.infer<typeof householdInvitationSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type ThreadedComment = z.infer<typeof threadedCommentSchema>;
export type ThreadedCommentPage = z.infer<typeof threadedCommentPageSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type CommentEntityType = z.infer<typeof commentEntityTypeSchema>;
export type EntryEntityType = z.infer<typeof entryEntityTypeSchema>;
export type EntryType = z.infer<typeof entryTypeSchema>;
export type EntryFlag = z.infer<typeof entryFlagSchema>;
export type EntrySortBy = z.infer<typeof entrySortBySchema>;
export type EntryMeasurement = z.infer<typeof entryMeasurementSchema>;
export type EntryResolvedEntity = z.infer<typeof entryResolvedEntitySchema>;
export type Entry = z.infer<typeof entrySchema>;
export type EntryListResponse = z.infer<typeof entryListResponseSchema>;
export type ActionableEntryGroup = z.infer<typeof actionableEntryGroupSchema>;
export type CreateEntryInput = z.input<typeof createEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
export type EntryListQuery = z.infer<typeof entryListQuerySchema>;
export type EntrySurfaceQuery = z.infer<typeof entrySurfaceQuerySchema>;
export type AssetTimelineEntry = z.infer<typeof assetTimelineEntrySchema>;
export type CreateAssetTimelineEntryInput = z.infer<typeof createAssetTimelineEntrySchema>;
export type UpdateAssetTimelineEntryInput = z.infer<typeof updateAssetTimelineEntrySchema>;
export type AssetTimelineItem = z.infer<typeof assetTimelineItemSchema>;
export type AssetTimelineQuery = z.infer<typeof assetTimelineQuerySchema>;
export type CreateProjectPurchaseRequestInput = z.infer<typeof createProjectPurchaseRequestSchema>;
export type ProjectPurchaseRequestResult = z.infer<typeof projectPurchaseRequestResultSchema>;
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

export const householdDataExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  householdId: z.string().cuid(),
  sections: z.record(z.string(), z.array(exportRecordSchema))
});

export type LinkPreviewField = z.infer<typeof linkPreviewFieldSchema>;
export type LinkPreviewResponse = z.infer<typeof linkPreviewResponseSchema>;
export type LinkPreviewRequest = z.infer<typeof linkPreviewRequestSchema>;
export type HouseholdDataExport = z.infer<typeof householdDataExportSchema>;
export type WebhookDeliveryStatus = z.infer<typeof webhookDeliveryStatusSchema>;
export type WebhookEndpoint = z.infer<typeof webhookEndpointSchema>;
export type CreateWebhookEndpointInput = z.infer<typeof createWebhookEndpointSchema>;
export type UpdateWebhookEndpointInput = z.infer<typeof updateWebhookEndpointSchema>;
export type DomainEvent = z.infer<typeof domainEventSchema>;
export type WebhookDelivery = z.infer<typeof webhookDeliverySchema>;

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

export const barcodeImageQuerySchema = z.object({
  value: z.string().min(1).max(100),
  format: z.string().max(30).optional(),
  output: z.enum(["png", "svg"]).default("png"),
  scale: z.coerce.number().int().min(1).max(5).default(2)
});

export type BarcodeImageQuery = z.infer<typeof barcodeImageQuerySchema>;

export const barcodeLabelsQuerySchema = z.object({
  itemIds: z.string().min(1)
});

export type BarcodeLabelsQuery = z.infer<typeof barcodeLabelsQuerySchema>;

// ── Attachment Schemas ───────────────────────────────────────────────

export const attachmentEntityTypeValues = [
  "maintenance_log",
  "asset",
  "project",
  "project_note",
  "project_expense",
  "project_phase",
  "project_task",
  "inventory_item",
  "hobby",
  "idea",
  "canvas",
  "canvas_object",
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
  deletedAt: z.string().datetime().nullable(),
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

export const hobbyActivityModeSchema = z.enum(["session", "project", "practice", "collection"]);
export type HobbyActivityMode = z.infer<typeof hobbyActivityModeSchema>;

export const hobbyProjectStatusSchema = z.enum(["planned", "active", "paused", "completed", "abandoned"]);
export type HobbyProjectStatus = z.infer<typeof hobbyProjectStatusSchema>;

export const hobbyPracticeGoalTypeSchema = z.enum(["metric_target", "session_count", "duration_total", "custom"]);
export type HobbyPracticeGoalType = z.infer<typeof hobbyPracticeGoalTypeSchema>;

export const hobbyPracticeGoalStatusSchema = z.enum(["active", "achieved", "abandoned", "paused"]);
export type HobbyPracticeGoalStatus = z.infer<typeof hobbyPracticeGoalStatusSchema>;

export const hobbyPracticeRoutineFrequencySchema = z.enum(["daily", "weekly", "biweekly", "monthly"]);
export type HobbyPracticeRoutineFrequency = z.infer<typeof hobbyPracticeRoutineFrequencySchema>;

export const hobbyCollectionItemStatusSchema = z.enum(["active", "dormant", "retired", "lost", "deceased"]);
export type HobbyCollectionItemStatus = z.infer<typeof hobbyCollectionItemStatusSchema>;

export const milestoneStatusSchema = z.enum(["pending", "in_progress", "completed", "skipped"]);
export type MilestoneStatus = z.infer<typeof milestoneStatusSchema>;

export const hobbySessionLifecycleModeSchema = z.enum(["binary", "pipeline"]);
export type HobbySessionLifecycleMode = z.infer<typeof hobbySessionLifecycleModeSchema>;

export const hobbyWorkflowChecklistTemplateSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  sortOrder: z.number().int().min(0).optional(),
});
export type HobbyWorkflowChecklistTemplate = z.infer<typeof hobbyWorkflowChecklistTemplateSchema>;

export const hobbyWorkflowSupplyTemplateSchema = z.object({
  id: z.string().optional(),
  inventoryItemId: z.string().cuid().nullable().optional(),
  name: z.string().min(1).max(200),
  quantityNeeded: z.number().positive(),
  unit: z.string().min(1).max(50),
  isRequired: z.boolean().default(true),
  notes: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type HobbyWorkflowSupplyTemplate = z.infer<typeof hobbyWorkflowSupplyTemplateSchema>;

export const hobbyWorkflowStageConfigSchema = z.object({
  id: z.string().cuid().optional(),
  label: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  instructions: z.string().max(5000).nullable().optional(),
  futureNotes: z.string().max(5000).nullable().optional(),
  fieldDefinitions: z.array(presetCustomFieldTemplateSchema).default([]),
  checklistTemplates: z.array(hobbyWorkflowChecklistTemplateSchema).default([]),
  supplyTemplates: z.array(hobbyWorkflowSupplyTemplateSchema).default([]),
  sortOrder: z.number().int().min(0),
  color: z.string().max(20).nullable().optional(),
  isFinal: z.boolean().default(false),
});
export type HobbyWorkflowStageConfig = z.infer<typeof hobbyWorkflowStageConfigSchema>;

export const seriesStatusSchema = z.enum(["active", "completed", "archived"]);
export type SeriesStatus = z.infer<typeof seriesStatusSchema>;

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
  activityMode: hobbyActivityModeSchema.default("session"),
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
  activityMode: hobbyActivityModeSchema.optional(),
  hobbyType: z.string().max(100).optional(),
  lifecycleMode: hobbySessionLifecycleModeSchema.optional(),
  statusPipeline: z.array(hobbyWorkflowStageConfigSchema).optional(),
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
export type HobbyStatusPipelineStepInput = HobbyWorkflowStageConfig;

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

export const hobbyLinkSummarySchema = z.object({
  id: z.string(),
  hobbyId: z.string(),
  hobbyName: z.string(),
  hobbyType: z.string().nullable(),
  hobbyStatus: z.string(),
  role: z.string().nullable(),
  notes: z.string().nullable(),
});
export type HobbyLinkSummary = z.infer<typeof hobbyLinkSummarySchema>;

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
    description: z.string().nullable(),
    instructions: z.string().nullable(),
    futureNotes: z.string().nullable(),
    fieldDefinitions: z.array(presetCustomFieldTemplateSchema),
    checklistTemplates: z.array(hobbyWorkflowChecklistTemplateSchema),
    supplyTemplates: z.array(hobbyWorkflowSupplyTemplateSchema),
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

// HobbyProjectLink (link table to top-level projects)
export const hobbyProjectLinkSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  projectId: z.string().cuid(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyProjectLink = z.infer<typeof hobbyProjectLinkSchema>;

export const createHobbyProjectLinkInputSchema = z.object({
  projectId: z.string().cuid(),
  notes: z.string().max(2000).optional(),
});
export const updateHobbyProjectLinkInputSchema = createHobbyProjectLinkInputSchema.partial().omit({ projectId: true });
export type CreateHobbyProjectLinkInput = z.infer<typeof createHobbyProjectLinkInputSchema>;
export type UpdateHobbyProjectLinkInput = z.infer<typeof updateHobbyProjectLinkInputSchema>;

// HobbyProject
export const hobbyProjectSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  householdId: z.string().cuid(),
  createdById: z.string().cuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: hobbyProjectStatusSchema,
  startDate: z.string().datetime().nullable(),
  targetEndDate: z.string().datetime().nullable(),
  completedDate: z.string().datetime().nullable(),
  coverImageUrl: z.string().nullable(),
  difficulty: z.string().nullable(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
  seriesId: z.string().cuid().nullable(),
  batchNumber: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyProject = z.infer<typeof hobbyProjectSchema>;

export const hobbyProjectMilestoneSchema = z.object({
  id: z.string().cuid(),
  hobbyProjectId: z.string().cuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: milestoneStatusSchema,
  sortOrder: z.number().int(),
  targetDate: z.string().datetime().nullable(),
  completedDate: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyProjectMilestone = z.infer<typeof hobbyProjectMilestoneSchema>;

export const hobbyProjectWorkLogSchema = z.object({
  id: z.string().cuid(),
  hobbyProjectId: z.string().cuid(),
  milestoneId: z.string().cuid().nullable(),
  date: z.string().datetime(),
  durationMinutes: z.number().int().nullable(),
  description: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyProjectWorkLog = z.infer<typeof hobbyProjectWorkLogSchema>;

export const hobbyProjectInventoryItemSchema = z.object({
  id: z.string().cuid(),
  hobbyProjectId: z.string().cuid(),
  inventoryItemId: z.string().cuid(),
  quantityNeeded: z.number(),
  quantityUsed: z.number(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyProjectInventoryItem = z.infer<typeof hobbyProjectInventoryItemSchema>;

export const hobbyProjectInventoryLinkDetailSchema = hobbyProjectInventoryItemSchema.extend({
  inventoryItem: inventoryItemSummarySchema,
  quantityRemaining: z.number(),
});
export type HobbyProjectInventoryLinkDetail = z.infer<typeof hobbyProjectInventoryLinkDetailSchema>;

export const hobbyProjectSummarySchema = hobbyProjectSchema.extend({
  milestoneCount: z.number().int().min(0),
  completedMilestoneCount: z.number().int().min(0),
  completionPercentage: z.number().min(0).max(100),
  totalLoggedHours: z.number().min(0),
});
export type HobbyProjectSummary = z.infer<typeof hobbyProjectSummarySchema>;

export const hobbyProjectEntryCountSchema = z.object({
  entryType: entryTypeSchema,
  count: z.number().int().min(0),
});
export type HobbyProjectEntryCount = z.infer<typeof hobbyProjectEntryCountSchema>;

export const hobbyProjectDetailSchema = hobbyProjectSchema.extend({
  milestones: z.array(hobbyProjectMilestoneSchema),
  recentWorkLogs: z.array(hobbyProjectWorkLogSchema),
  inventoryItems: z.array(hobbyProjectInventoryLinkDetailSchema),
  totalLoggedHours: z.number().min(0),
  daysActive: z.number().int().min(0).nullable(),
  milestoneCount: z.number().int().min(0),
  completedMilestoneCount: z.number().int().min(0),
  milestoneCompletionPercentage: z.number().min(0).max(100),
  entryCountsByType: z.array(hobbyProjectEntryCountSchema),
});
export type HobbyProjectDetail = z.infer<typeof hobbyProjectDetailSchema>;

const hobbyPracticeTagSchema = z.string().trim().min(1).max(80);

export const hobbyPracticeGoalProgressPointSchema = z.object({
  value: z.number(),
  date: z.string().datetime(),
  sourceType: z.enum(["metric", "session", "manual"]),
  sourceId: z.string().nullable(),
  label: z.string().nullable(),
});
export type HobbyPracticeGoalProgressPoint = z.infer<typeof hobbyPracticeGoalProgressPointSchema>;

export const hobbyPracticeGoalSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  householdId: z.string().cuid(),
  createdById: z.string().cuid(),
  name: z.string(),
  description: z.string().nullable(),
  goalType: hobbyPracticeGoalTypeSchema,
  targetValue: z.number(),
  currentValue: z.number(),
  unit: z.string(),
  metricDefinitionId: z.string().cuid().nullable(),
  startDate: z.string().datetime().nullable(),
  targetDate: z.string().datetime().nullable(),
  status: hobbyPracticeGoalStatusSchema,
  tags: z.array(hobbyPracticeTagSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyPracticeGoal = z.infer<typeof hobbyPracticeGoalSchema>;

export const hobbyPracticeGoalSummarySchema = hobbyPracticeGoalSchema.extend({
  progressPercentage: z.number().min(0),
});
export type HobbyPracticeGoalSummary = z.infer<typeof hobbyPracticeGoalSummarySchema>;

export const hobbyPracticeGoalDetailSchema = hobbyPracticeGoalSummarySchema.extend({
  progressHistory: z.array(hobbyPracticeGoalProgressPointSchema),
});
export type HobbyPracticeGoalDetail = z.infer<typeof hobbyPracticeGoalDetailSchema>;

export const hobbyPracticeGoalListQuerySchema = z.object({
  status: hobbyPracticeGoalStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().cuid().optional(),
});
export type HobbyPracticeGoalListQuery = z.infer<typeof hobbyPracticeGoalListQuerySchema>;

export const hobbyPracticeGoalListResponseSchema = z.object({
  items: z.array(hobbyPracticeGoalSummarySchema),
  nextCursor: z.string().cuid().nullable(),
});
export type HobbyPracticeGoalListResponse = z.infer<typeof hobbyPracticeGoalListResponseSchema>;

export const createHobbyPracticeGoalInputSchema = z.object({
  name: z.string().trim().min(1).max(300),
  description: z.string().max(2000).optional(),
  goalType: hobbyPracticeGoalTypeSchema,
  targetValue: z.number(),
  currentValue: z.number().optional(),
  unit: z.string().trim().min(1).max(100),
  metricDefinitionId: z.string().cuid().optional(),
  startDate: z.string().datetime().optional(),
  targetDate: z.string().datetime().optional(),
  status: hobbyPracticeGoalStatusSchema.optional(),
  tags: z.array(hobbyPracticeTagSchema).max(50).optional(),
});
export const updateHobbyPracticeGoalInputSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(2000).nullable().optional(),
  goalType: hobbyPracticeGoalTypeSchema.optional(),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  unit: z.string().trim().min(1).max(100).optional(),
  metricDefinitionId: z.string().cuid().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  targetDate: z.string().datetime().nullable().optional(),
  status: hobbyPracticeGoalStatusSchema.optional(),
  tags: z.array(hobbyPracticeTagSchema).max(50).optional(),
});
export type CreateHobbyPracticeGoalInput = z.infer<typeof createHobbyPracticeGoalInputSchema>;
export type UpdateHobbyPracticeGoalInput = z.infer<typeof updateHobbyPracticeGoalInputSchema>;

export const hobbyPracticeRoutineSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  householdId: z.string().cuid(),
  createdById: z.string().cuid(),
  name: z.string(),
  description: z.string().nullable(),
  targetDurationMinutes: z.number().int().nullable(),
  targetFrequency: hobbyPracticeRoutineFrequencySchema,
  targetSessionsPerPeriod: z.number().int().min(1),
  isActive: z.boolean(),
  currentStreak: z.number().int().min(0),
  longestStreak: z.number().int().min(0),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyPracticeRoutine = z.infer<typeof hobbyPracticeRoutineSchema>;

export const hobbyPracticeRoutineSummarySchema = hobbyPracticeRoutineSchema.extend({
  adherenceRate: z.number().min(0),
  nextExpectedSessionDate: z.string().datetime().nullable(),
});
export type HobbyPracticeRoutineSummary = z.infer<typeof hobbyPracticeRoutineSummarySchema>;

export const hobbyPracticeRoutineListQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().cuid().optional(),
});
export type HobbyPracticeRoutineListQuery = z.infer<typeof hobbyPracticeRoutineListQuerySchema>;

export const hobbyPracticeRoutineListResponseSchema = z.object({
  items: z.array(hobbyPracticeRoutineSummarySchema),
  nextCursor: z.string().cuid().nullable(),
});
export type HobbyPracticeRoutineListResponse = z.infer<typeof hobbyPracticeRoutineListResponseSchema>;

export const hobbyPracticeRoutineCompliancePeriodSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  expectedSessions: z.number().int().min(0),
  completedSessions: z.number().int().min(0),
  metTarget: z.boolean(),
});
export type HobbyPracticeRoutineCompliancePeriod = z.infer<typeof hobbyPracticeRoutineCompliancePeriodSchema>;

export const hobbyPracticeRoutineComplianceSummarySchema = z.object({
  routineId: z.string().cuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  periods: z.array(hobbyPracticeRoutineCompliancePeriodSchema),
  totalExpectedSessions: z.number().int().min(0),
  totalCompletedSessions: z.number().int().min(0),
  adherenceRate: z.number().min(0),
});
export type HobbyPracticeRoutineComplianceSummary = z.infer<typeof hobbyPracticeRoutineComplianceSummarySchema>;

export const hobbyPracticeRoutineComplianceQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});
export type HobbyPracticeRoutineComplianceQuery = z.infer<typeof hobbyPracticeRoutineComplianceQuerySchema>;

export const createHobbyPracticeRoutineInputSchema = z.object({
  name: z.string().trim().min(1).max(300),
  description: z.string().max(2000).optional(),
  targetDurationMinutes: z.number().int().min(1).optional(),
  targetFrequency: hobbyPracticeRoutineFrequencySchema,
  targetSessionsPerPeriod: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(20000).optional(),
});
export const updateHobbyPracticeRoutineInputSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(2000).nullable().optional(),
  targetDurationMinutes: z.number().int().min(1).nullable().optional(),
  targetFrequency: hobbyPracticeRoutineFrequencySchema.optional(),
  targetSessionsPerPeriod: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(20000).nullable().optional(),
});
export type CreateHobbyPracticeRoutineInput = z.infer<typeof createHobbyPracticeRoutineInputSchema>;
export type UpdateHobbyPracticeRoutineInput = z.infer<typeof updateHobbyPracticeRoutineInputSchema>;

export const hobbyCollectionItemSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  householdId: z.string().cuid(),
  createdById: z.string().cuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: hobbyCollectionItemStatusSchema,
  acquiredDate: z.string().datetime().nullable(),
  retiredDate: z.string().datetime().nullable(),
  coverImageUrl: z.string().nullable(),
  location: z.string().nullable(),
  customFields: z.record(z.unknown()),
  quantity: z.number().int().min(0),
  tags: z.array(hobbyPracticeTagSchema),
  notes: z.string().nullable(),
  parentItemId: z.string().cuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbyCollectionItem = z.infer<typeof hobbyCollectionItemSchema>;

export const hobbyCollectionItemSessionSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  recipeId: z.string().cuid().nullable(),
  seriesId: z.string().cuid().nullable(),
  routineId: z.string().cuid().nullable(),
  collectionItemId: z.string().cuid().nullable(),
  batchNumber: z.number().int().nullable(),
  name: z.string(),
  status: z.string(),
  startDate: z.string().datetime().nullable(),
  completedDate: z.string().datetime().nullable(),
  durationMinutes: z.number().int().nullable(),
  pipelineStepId: z.string().cuid().nullable(),
  customFields: z.record(z.unknown()),
  totalCost: z.number().nullable(),
  rating: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  recipeName: z.string().nullable(),
  routineName: z.string().nullable(),
});
export type HobbyCollectionItemSession = z.infer<typeof hobbyCollectionItemSessionSchema>;

export const hobbyCollectionItemMetricReadingSchema = z.object({
  id: z.string().cuid(),
  metricDefinitionId: z.string().cuid(),
  sessionId: z.string().cuid().nullable(),
  value: z.number(),
  readingDate: z.string().datetime(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  metricName: z.string(),
  metricUnit: z.string(),
  sessionName: z.string().nullable(),
});
export type HobbyCollectionItemMetricReading = z.infer<typeof hobbyCollectionItemMetricReadingSchema>;

export const hobbyCollectionItemDetailSchema = hobbyCollectionItemSchema.extend({
  childItems: z.array(hobbyCollectionItemSchema),
  sessionHistory: z.array(hobbyCollectionItemSessionSchema),
  entryTimeline: z.array(entrySchema),
  metricReadings: z.array(hobbyCollectionItemMetricReadingSchema),
});
export type HobbyCollectionItemDetail = z.infer<typeof hobbyCollectionItemDetailSchema>;

export const hobbyCollectionItemListQuerySchema = z.object({
  status: hobbyCollectionItemStatusSchema.optional(),
  location: z.string().max(200).optional(),
  tag: hobbyPracticeTagSchema.optional(),
  search: z.string().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().cuid().optional(),
});
export type HobbyCollectionItemListQuery = z.infer<typeof hobbyCollectionItemListQuerySchema>;

export const hobbyCollectionItemListResponseSchema = z.object({
  items: z.array(hobbyCollectionItemSchema),
  nextCursor: z.string().cuid().nullable(),
});
export type HobbyCollectionItemListResponse = z.infer<typeof hobbyCollectionItemListResponseSchema>;

export const createHobbyCollectionItemInputSchema = z.object({
  name: z.string().trim().min(1).max(300),
  description: z.string().max(2000).optional(),
  status: hobbyCollectionItemStatusSchema.optional(),
  acquiredDate: z.string().datetime().optional(),
  retiredDate: z.string().datetime().optional(),
  coverImageUrl: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  customFields: z.record(z.unknown()).optional(),
  quantity: z.number().int().min(0).optional(),
  tags: z.array(hobbyPracticeTagSchema).max(50).optional(),
  notes: z.string().max(20000).optional(),
  parentItemId: z.string().cuid().optional(),
});
export const updateHobbyCollectionItemInputSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: hobbyCollectionItemStatusSchema.optional(),
  acquiredDate: z.string().datetime().nullable().optional(),
  retiredDate: z.string().datetime().nullable().optional(),
  coverImageUrl: z.string().max(2000).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  customFields: z.record(z.unknown()).optional(),
  quantity: z.number().int().min(0).optional(),
  tags: z.array(hobbyPracticeTagSchema).max(50).optional(),
  notes: z.string().max(20000).nullable().optional(),
  parentItemId: z.string().cuid().nullable().optional(),
});
export type CreateHobbyCollectionItemInput = z.infer<typeof createHobbyCollectionItemInputSchema>;
export type UpdateHobbyCollectionItemInput = z.infer<typeof updateHobbyCollectionItemInputSchema>;

export const bulkUpdateHobbyCollectionItemStatusInputSchema = z.object({
  status: hobbyCollectionItemStatusSchema,
  location: z.string().max(200).optional(),
  itemIds: z.array(z.string().cuid()).max(500).optional(),
}).refine((value) => Boolean(value.location || (value.itemIds && value.itemIds.length > 0)), {
  message: "Provide location or itemIds to select collection items.",
});
export type BulkUpdateHobbyCollectionItemStatusInput = z.infer<typeof bulkUpdateHobbyCollectionItemStatusInputSchema>;

export const hobbyProjectListQuerySchema = z.object({
  status: hobbyProjectStatusSchema.optional(),
  sortBy: z.enum(["updatedAt", "startDate"]).default("updatedAt"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().cuid().optional(),
});
export type HobbyProjectListQuery = z.infer<typeof hobbyProjectListQuerySchema>;

export const hobbyProjectListResponseSchema = z.object({
  items: z.array(hobbyProjectSummarySchema),
  nextCursor: z.string().cuid().nullable(),
});
export type HobbyProjectListResponse = z.infer<typeof hobbyProjectListResponseSchema>;

export const createHobbyProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(300),
  description: z.string().max(5000).optional(),
  status: hobbyProjectStatusSchema.optional(),
  startDate: z.string().datetime().optional(),
  targetEndDate: z.string().datetime().optional(),
  completedDate: z.string().datetime().optional(),
  coverImageUrl: z.string().max(2000).optional(),
  difficulty: z.string().max(80).optional(),
  notes: z.string().max(20000).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  seriesId: z.string().cuid().optional(),
  batchNumber: z.number().int().positive().optional(),
});
export const updateHobbyProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: hobbyProjectStatusSchema.optional(),
  startDate: z.string().datetime().nullable().optional(),
  targetEndDate: z.string().datetime().nullable().optional(),
  completedDate: z.string().datetime().nullable().optional(),
  coverImageUrl: z.string().max(2000).nullable().optional(),
  difficulty: z.string().max(80).nullable().optional(),
  notes: z.string().max(20000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  seriesId: z.string().cuid().nullable().optional(),
  batchNumber: z.number().int().positive().nullable().optional(),
});
export type CreateHobbyProjectInput = z.infer<typeof createHobbyProjectInputSchema>;
export type UpdateHobbyProjectInput = z.infer<typeof updateHobbyProjectInputSchema>;

export const createHobbyProjectMilestoneInputSchema = z.object({
  name: z.string().trim().min(1).max(300),
  description: z.string().max(2000).optional(),
  status: milestoneStatusSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
  targetDate: z.string().datetime().optional(),
  completedDate: z.string().datetime().optional(),
  notes: z.string().max(20000).optional(),
});
export const updateHobbyProjectMilestoneInputSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: milestoneStatusSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
  targetDate: z.string().datetime().nullable().optional(),
  completedDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(20000).nullable().optional(),
});
export const reorderHobbyProjectMilestonesInputSchema = z.object({
  milestoneIds: z.array(z.string().cuid()).min(1),
});
export type CreateHobbyProjectMilestoneInput = z.infer<typeof createHobbyProjectMilestoneInputSchema>;
export type UpdateHobbyProjectMilestoneInput = z.infer<typeof updateHobbyProjectMilestoneInputSchema>;
export type ReorderHobbyProjectMilestonesInput = z.infer<typeof reorderHobbyProjectMilestonesInputSchema>;

export const createHobbyProjectWorkLogInputSchema = z.object({
  milestoneId: z.string().cuid().optional(),
  date: z.string().datetime(),
  durationMinutes: z.number().int().min(0).optional(),
  description: z.string().trim().min(1).max(5000),
  notes: z.string().max(20000).optional(),
});
export const updateHobbyProjectWorkLogInputSchema = z.object({
  milestoneId: z.string().cuid().nullable().optional(),
  date: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(0).nullable().optional(),
  description: z.string().trim().min(1).max(5000).optional(),
  notes: z.string().max(20000).nullable().optional(),
});
export const hobbyProjectWorkLogListQuerySchema = z.object({
  milestoneId: z.string().cuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().cuid().optional(),
});
export const hobbyProjectWorkLogListResponseSchema = z.object({
  items: z.array(hobbyProjectWorkLogSchema),
  nextCursor: z.string().cuid().nullable(),
  totalDurationMinutes: z.number().int().min(0),
  totalDurationHours: z.number().min(0),
});
export type CreateHobbyProjectWorkLogInput = z.infer<typeof createHobbyProjectWorkLogInputSchema>;
export type UpdateHobbyProjectWorkLogInput = z.infer<typeof updateHobbyProjectWorkLogInputSchema>;
export type HobbyProjectWorkLogListQuery = z.infer<typeof hobbyProjectWorkLogListQuerySchema>;
export type HobbyProjectWorkLogListResponse = z.infer<typeof hobbyProjectWorkLogListResponseSchema>;

export const createHobbyProjectInventoryItemInputSchema = z.object({
  inventoryItemId: z.string().cuid(),
  quantityNeeded: z.number().positive(),
  quantityUsed: z.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
});
export const updateHobbyProjectInventoryItemInputSchema = z.object({
  quantityNeeded: z.number().positive().optional(),
  quantityUsed: z.number().min(0).optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type CreateHobbyProjectInventoryItemInput = z.infer<typeof createHobbyProjectInventoryItemInputSchema>;
export type UpdateHobbyProjectInventoryItemInput = z.infer<typeof updateHobbyProjectInventoryItemInputSchema>;

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
  description: z.string().nullable(),
  instructions: z.string().nullable(),
  futureNotes: z.string().nullable(),
  fieldDefinitions: z.array(presetCustomFieldTemplateSchema),
  checklistTemplates: z.array(hobbyWorkflowChecklistTemplateSchema),
  supplyTemplates: z.array(hobbyWorkflowSupplyTemplateSchema),
  sortOrder: z.number(),
  color: z.string().nullable(),
  isFinal: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbySessionStatusStep = z.infer<typeof hobbySessionStatusStepSchema>;

export const createHobbySessionStatusStepInputSchema = z.object({
  label: z.string().min(1).max(100),
  description: z.string().max(2000).nullable().optional(),
  instructions: z.string().max(5000).nullable().optional(),
  futureNotes: z.string().max(5000).nullable().optional(),
  fieldDefinitions: z.array(presetCustomFieldTemplateSchema).optional(),
  checklistTemplates: z.array(hobbyWorkflowChecklistTemplateSchema).optional(),
  supplyTemplates: z.array(hobbyWorkflowSupplyTemplateSchema).optional(),
  sortOrder: z.number().int(),
  color: z.string().max(50).nullable().optional(),
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
  seriesId: z.string().cuid().nullable(),
  routineId: z.string().cuid().nullable(),
  collectionItemId: z.string().cuid().nullable(),
  batchNumber: z.number().int().nullable(),
  name: z.string(),
  status: z.string(),
  startDate: z.string().datetime().nullable(),
  completedDate: z.string().datetime().nullable(),
  durationMinutes: z.number().int().nullable(),
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
  routineId: z.string().cuid().optional(),
  collectionItemId: z.string().cuid().optional(),
  name: z.string().min(1).max(200),
  status: z.string().max(100).optional(),
  startDate: z.string().datetime().optional(),
  completedDate: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(0).optional(),
  customFields: z.record(z.unknown()).optional(),
  totalCost: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateHobbySessionInputSchema = createHobbySessionInputSchema.partial().extend({
  completedDate: z.string().datetime().nullable().optional(),
  routineId: z.string().cuid().nullable().optional(),
  collectionItemId: z.string().cuid().nullable().optional(),
  durationMinutes: z.number().int().min(0).nullable().optional(),
  totalCost: z.number().min(0).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export type CreateHobbySessionInput = z.infer<typeof createHobbySessionInputSchema>;
export type UpdateHobbySessionInput = z.infer<typeof updateHobbySessionInputSchema>;

export const hobbySessionStageChecklistItemSchema = z.object({
  id: z.string().cuid(),
  sessionStageId: z.string().cuid(),
  title: z.string(),
  sortOrder: z.number(),
  isCompleted: z.boolean(),
  completedAt: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbySessionStageChecklistItem = z.infer<typeof hobbySessionStageChecklistItemSchema>;

export const createHobbySessionStageChecklistItemInputSchema = z.object({
  title: z.string().min(1).max(200),
  sortOrder: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateHobbySessionStageChecklistItemInputSchema = createHobbySessionStageChecklistItemInputSchema.partial().extend({
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).nullable().optional(),
  isCompleted: z.boolean().optional(),
  completedAt: z.string().datetime().nullable().optional(),
});
export type CreateHobbySessionStageChecklistItemInput = z.infer<typeof createHobbySessionStageChecklistItemInputSchema>;
export type UpdateHobbySessionStageChecklistItemInput = z.infer<typeof updateHobbySessionStageChecklistItemInputSchema>;

export const hobbySessionStageSupplySchema = z.object({
  id: z.string().cuid(),
  sessionStageId: z.string().cuid(),
  inventoryItemId: z.string().cuid().nullable(),
  name: z.string(),
  quantityNeeded: z.number(),
  unit: z.string(),
  isRequired: z.boolean(),
  notes: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbySessionStageSupply = z.infer<typeof hobbySessionStageSupplySchema>;

export const hobbySessionStageDetailSupplySchema = hobbySessionStageSupplySchema.extend({
  inventoryItem: z.object({ id: z.string(), name: z.string(), unit: z.string(), quantityOnHand: z.number() }).nullable(),
  hasSufficientInventory: z.boolean(),
});
export type HobbySessionStageDetailSupply = z.infer<typeof hobbySessionStageDetailSupplySchema>;

export const hobbySessionStageSchema = z.object({
  id: z.string().cuid(),
  sessionId: z.string().cuid(),
  stageTemplateId: z.string().cuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  instructions: z.string().nullable(),
  futureNotes: z.string().nullable(),
  fieldDefinitions: z.array(presetCustomFieldTemplateSchema),
  sortOrder: z.number(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  customFieldValues: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbySessionStage = z.infer<typeof hobbySessionStageSchema>;

export const hobbySessionStageDetailSchema = hobbySessionStageSchema.extend({
  checklistItems: z.array(hobbySessionStageChecklistItemSchema),
  supplies: z.array(hobbySessionStageDetailSupplySchema),
});
export type HobbySessionStageDetail = z.infer<typeof hobbySessionStageDetailSchema>;

export const updateHobbySessionStageInputSchema = z.object({
  notes: z.string().max(5000).nullable().optional(),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  customFieldValues: z.record(z.unknown()).optional(),
});
export type UpdateHobbySessionStageInput = z.infer<typeof updateHobbySessionStageInputSchema>;

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

export const bulkLogHobbySessionsSchema = z.object({
  householdId: z.string().cuid(),
  hobbyId: z.string().cuid(),
  sessions: z.array(z.object({
    name: z.string().min(1).max(200),
    startDate: z.string().datetime().nullable().optional(),
    completedDate: z.string().datetime().nullable().optional(),
    durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
    notes: z.string().max(2000).nullable().optional()
  })).min(1).max(50)
});

export const bulkArchiveHobbySessionsSchema = z.object({
  householdId: z.string().cuid(),
  hobbyId: z.string().cuid(),
  sessionIds: z.array(z.string().cuid()).min(1).max(100)
});

export const bulkHobbySessionOperationResultSchema = z.object({
  succeeded: z.number(),
  failed: z.array(bulkFailedItemSchema)
});

const hobbySeriesTagSchema = z.string().trim().min(1).max(80);

export const hobbySeriesSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  householdId: z.string().cuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: seriesStatusSchema,
  batchCount: z.number().int().min(0),
  bestBatchSessionId: z.string().cuid().nullable(),
  tags: z.array(hobbySeriesTagSchema),
  notes: z.string().nullable(),
  coverImageUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HobbySeries = z.infer<typeof hobbySeriesSchema>;

export const hobbySeriesSummarySchema = hobbySeriesSchema.extend({
  bestBatchSessionName: z.string().nullable(),
  lastSessionDate: z.string().datetime().nullable(),
});
export type HobbySeriesSummary = z.infer<typeof hobbySeriesSummarySchema>;

export const createHobbySeriesInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: seriesStatusSchema.optional(),
  sessionIds: z.array(z.string().cuid()).max(200).optional(),
  tags: z.array(hobbySeriesTagSchema).max(50).optional(),
  notes: z.string().max(10000).optional(),
  coverImageUrl: z.string().url().max(2000).optional(),
});
export type CreateHobbySeriesInput = z.infer<typeof createHobbySeriesInputSchema>;

export const updateHobbySeriesInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: seriesStatusSchema.optional(),
  tags: z.array(hobbySeriesTagSchema).max(50).optional(),
  notes: z.string().max(10000).nullable().optional(),
  coverImageUrl: z.string().url().max(2000).nullable().optional(),
  bestBatchSessionId: z.string().cuid().nullable().optional(),
});
export type UpdateHobbySeriesInput = z.infer<typeof updateHobbySeriesInputSchema>;

export const hobbySeriesMetricReadingSchema = z.object({
  id: z.string().cuid(),
  metricDefinitionId: z.string().cuid(),
  metricName: z.string(),
  metricUnit: z.string(),
  value: z.number(),
  readingDate: z.string().datetime(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type HobbySeriesMetricReading = z.infer<typeof hobbySeriesMetricReadingSchema>;

export const hobbySeriesSessionSchema = z.object({
  id: z.string().cuid(),
  hobbyId: z.string().cuid(),
  recipeId: z.string().cuid().nullable(),
  seriesId: z.string().cuid().nullable(),
  batchNumber: z.number().int().nullable(),
  name: z.string(),
  date: z.string().datetime().nullable(),
  status: z.string(),
  rating: z.number().nullable(),
  recipeName: z.string().nullable(),
  metricReadings: z.array(hobbySeriesMetricReadingSchema),
});
export type HobbySeriesSession = z.infer<typeof hobbySeriesSessionSchema>;

export const hobbySeriesDetailSchema = hobbySeriesSummarySchema.extend({
  sessions: z.array(hobbySeriesSessionSchema),
  entries: z.array(entrySchema),
});
export type HobbySeriesDetail = z.infer<typeof hobbySeriesDetailSchema>;

export const hobbySeriesComparisonMetricValueSchema = z.object({
  id: z.string().cuid(),
  value: z.number(),
  readingDate: z.string().datetime(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type HobbySeriesComparisonMetricValue = z.infer<typeof hobbySeriesComparisonMetricValueSchema>;

export const hobbySeriesComparisonMetricGroupSchema = z.object({
  metricDefinitionId: z.string().cuid(),
  metricName: z.string(),
  metricUnit: z.string(),
  readings: z.array(hobbySeriesComparisonMetricValueSchema),
});
export type HobbySeriesComparisonMetricGroup = z.infer<typeof hobbySeriesComparisonMetricGroupSchema>;

export const hobbySeriesComparisonSessionSchema = z.object({
  sessionId: z.string().cuid(),
  name: z.string(),
  batchNumber: z.number().int().nullable(),
  date: z.string().datetime().nullable(),
  status: z.string(),
  rating: z.number().nullable(),
  recipeName: z.string().nullable(),
  metricGroups: z.array(hobbySeriesComparisonMetricGroupSchema),
  entries: z.array(entrySchema),
});
export type HobbySeriesComparisonSession = z.infer<typeof hobbySeriesComparisonSessionSchema>;

export const hobbySeriesComparisonSchema = z.object({
  series: hobbySeriesSummarySchema,
  sessions: z.array(hobbySeriesComparisonSessionSchema),
});
export type HobbySeriesComparison = z.infer<typeof hobbySeriesComparisonSchema>;

export const linkHobbySeriesSessionInputSchema = z.object({
  sessionId: z.string().cuid(),
});
export type LinkHobbySeriesSessionInput = z.infer<typeof linkHobbySeriesSessionInputSchema>;

export const updateHobbySeriesSessionInputSchema = z.object({
  batchNumber: z.number().int().min(1),
});
export type UpdateHobbySeriesSessionInput = z.infer<typeof updateHobbySeriesSessionInputSchema>;

export const hobbySeriesListSchema = z.array(hobbySeriesSummarySchema);

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

export const hobbyMetricReadingPageSchema = z.object({
  items: z.array(hobbyMetricReadingSchema),
  nextCursor: z.string().cuid().nullable(),
});
export type HobbyMetricReadingPage = z.infer<typeof hobbyMetricReadingPageSchema>;

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

export const hobbyRecipeSummarySchema = hobbyRecipeSchema.extend({
  ingredientCount: z.number(),
  stepCount: z.number(),
  sessionCount: z.number(),
});
export type HobbyRecipeSummary = z.infer<typeof hobbyRecipeSummarySchema>;

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
  stages: z.array(hobbySessionStageDetailSchema),
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
  description: z.string().max(2000).optional(),
  instructions: z.string().max(5000).optional(),
  futureNotes: z.string().max(5000).optional(),
  fieldDefinitions: z.array(presetCustomFieldTemplateSchema).default([]),
  checklistTemplates: z.array(hobbyWorkflowChecklistTemplateSchema).default([]),
  supplyTemplates: z.array(hobbyWorkflowSupplyTemplateSchema).default([]),
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

// ── NoteFolder ─────────────────────────────────────────────────

export const noteFolderSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  parentFolderId: z.string().cuid().nullable().default(null),
  name: z.string().min(1).max(200),
  color: z.string().max(30).nullable().default(null),
  icon: z.string().max(30).nullable().default(null),
  sortOrder: z.number().int().default(0),
  createdById: z.string().cuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type NoteFolder = z.infer<typeof noteFolderSchema>;

export const noteFolderTreeSchema: z.ZodType<NoteFolder & { children: Array<NoteFolder & { children: unknown[] }> }> = z.lazy(() =>
  noteFolderSchema.extend({
    children: z.array(noteFolderTreeSchema).default([])
  })
) as z.ZodType<NoteFolder & { children: Array<NoteFolder & { children: unknown[] }> }>;
export type NoteFolderTree = z.infer<typeof noteFolderTreeSchema>;

export const noteFolderListSchema = z.array(noteFolderTreeSchema);

export const createNoteFolderSchema = z.object({
  name: z.string().trim().min(1).max(200),
  parentFolderId: z.string().cuid().optional().nullable(),
  color: z.string().trim().max(30).optional().nullable(),
  icon: z.string().trim().max(30).optional().nullable(),
  sortOrder: z.number().int().optional()
});
export type CreateNoteFolderInput = z.infer<typeof createNoteFolderSchema>;

export const updateNoteFolderSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  parentFolderId: z.string().cuid().optional().nullable(),
  color: z.string().trim().max(30).optional().nullable(),
  icon: z.string().trim().max(30).optional().nullable(),
  sortOrder: z.number().int().optional()
});
export type UpdateNoteFolderInput = z.infer<typeof updateNoteFolderSchema>;

// ── NoteTemplate ───────────────────────────────────────────────

export const noteTemplateSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).nullable().default(null),
  bodyTemplate: z.string().max(20000),
  entryType: entryTypeSchema.default("note"),
  defaultTags: z.array(z.string().max(100)).max(20).default([]),
  defaultFlags: z.array(entryFlagSchema).default([]),
  isBuiltIn: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  createdById: z.string().cuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type NoteTemplate = z.infer<typeof noteTemplateSchema>;

export const noteTemplateListSchema = z.array(noteTemplateSchema);

export const createNoteTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional().nullable(),
  bodyTemplate: z.string().max(20000),
  entryType: entryTypeSchema.optional(),
  defaultTags: z.array(z.string().trim().max(100)).max(20).optional(),
  defaultFlags: z.array(entryFlagSchema).optional(),
  sortOrder: z.number().int().optional()
});
export type CreateNoteTemplateInput = z.input<typeof createNoteTemplateSchema>;

export const updateNoteTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  bodyTemplate: z.string().max(20000).optional(),
  entryType: entryTypeSchema.optional(),
  defaultTags: z.array(z.string().trim().max(100)).max(20).optional(),
  defaultFlags: z.array(entryFlagSchema).optional(),
  sortOrder: z.number().int().optional()
});
export type UpdateNoteTemplateInput = z.infer<typeof updateNoteTemplateSchema>;

// ─── Idea Canvas ─────────────────────────────────────────────────────────────

export const canvasNodeShapeSchema = z.enum([
  "rectangle", "rounded", "pill", "diamond"
]);
export type CanvasNodeShape = z.infer<typeof canvasNodeShapeSchema>;

export const canvasEdgeStyleSchema = z.enum([
  "solid", "dashed", "dotted"
]);
export type CanvasEdgeStyle = z.infer<typeof canvasEdgeStyleSchema>;

export const canvasObjectTypeSchema = z.enum([
  "flowchart", "rect", "circle", "line", "text", "image", "object",
  "wall", "door", "window", "stairs", "room", "dimension", "freehand",
]);
export type CanvasObjectType = z.infer<typeof canvasObjectTypeSchema>;

export const canvasModeSchema = z.enum(["diagram", "floorplan", "freehand"]);
export type CanvasMode = z.infer<typeof canvasModeSchema>;

export const canvasPhysicalUnitSchema = z.enum(["ft", "m", "in", "cm"]);
export type CanvasPhysicalUnit = z.infer<typeof canvasPhysicalUnitSchema>;

export const ideaCanvasLayerSchema = z.object({
  id: z.string(),
  canvasId: z.string(),
  name: z.string(),
  visible: z.boolean(),
  locked: z.boolean(),
  sortOrder: z.number(),
  opacity: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type IdeaCanvasLayer = z.infer<typeof ideaCanvasLayerSchema>;

export const createCanvasLayerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  sortOrder: z.number().int().optional(),
  opacity: z.number().min(0).max(1).default(1),
});
export type CreateCanvasLayerInput = z.input<typeof createCanvasLayerSchema>;

export const updateCanvasLayerSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  visible: z.boolean().optional(),
  locked: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  opacity: z.number().min(0).max(1).optional(),
});
export type UpdateCanvasLayerInput = z.infer<typeof updateCanvasLayerSchema>;

export const reorderCanvasLayersSchema = z.object({
  layers: z.array(z.object({ id: z.string(), sortOrder: z.number().int() })).min(1).max(50),
});
export type ReorderCanvasLayersInput = z.infer<typeof reorderCanvasLayersSchema>;

export const ideaCanvasNodeSchema = z.object({
  id: z.string(),
  canvasId: z.string(),
  entryId: z.string().nullable(),
  label: z.string(),
  body: z.string().nullable(),
  x: z.number(),
  y: z.number(),
  x2: z.number(),
  y2: z.number(),
  width: z.number(),
  height: z.number(),
  color: z.string().nullable(),
  strokeColor: z.string().nullable(),
  fillColor: z.string().nullable(),
  strokeWidth: z.number(),
  shape: canvasNodeShapeSchema,
  objectType: canvasObjectTypeSchema,
  rotation: z.number(),
  sortOrder: z.number(),
  imageUrl: z.string().nullable().optional(),
  maskJson: z.string().nullable().optional(),
  // Building / floorplan fields
  wallThickness: z.number().optional(),
  wallAngle: z.number().nullable().optional(),
  wallHeight: z.number().nullable().optional(),
  physicalLength: z.number().nullable().optional(),
  parentNodeId: z.string().nullable().optional(),
  pointAx: z.number().nullable().optional(),
  pointAy: z.number().nullable().optional(),
  pointBx: z.number().nullable().optional(),
  pointBy: z.number().nullable().optional(),
  // Freehand / polyline data
  pointsJson: z.string().nullable().optional(),
  // Layer assignment
  layerId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type IdeaCanvasNode = z.infer<typeof ideaCanvasNodeSchema>;

export const ideaCanvasEdgeSchema = z.object({
  id: z.string(),
  canvasId: z.string(),
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  label: z.string().nullable(),
  style: canvasEdgeStyleSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type IdeaCanvasEdge = z.infer<typeof ideaCanvasEdgeSchema>;

export const canvasGuideSchema = z.object({
  id: z.string(),
  axis: z.enum(["horizontal", "vertical"]),
  /** Position in canvas coords */
  position: z.number(),
});
export type CanvasGuide = z.infer<typeof canvasGuideSchema>;

export const ideaCanvasSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  name: z.string(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  zoom: z.number(),
  panX: z.number(),
  panY: z.number(),
  physicalWidth: z.number().nullable(),
  physicalHeight: z.number().nullable(),
  physicalUnit: z.string().nullable(),
  backgroundImageUrl: z.string().nullable(),
  backgroundImageOpacity: z.number().default(0.5),
  snapToGrid: z.boolean(),
  gridSize: z.number(),
  canvasMode: canvasModeSchema,
  showDimensions: z.boolean(),
  guides: z.array(canvasGuideSchema).default([]),
  createdById: z.string(),
  nodes: z.array(ideaCanvasNodeSchema),
  edges: z.array(ideaCanvasEdgeSchema),
  layers: z.array(ideaCanvasLayerSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type IdeaCanvas = z.infer<typeof ideaCanvasSchema>;

export const ideaCanvasSummarySchema = z.object({
  id: z.string(),
  householdId: z.string(),
  name: z.string(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  canvasMode: canvasModeSchema,
  nodeCount: z.number(),
  edgeCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type IdeaCanvasSummary = z.infer<typeof ideaCanvasSummarySchema>;

export const ideaCanvasThumbnailNodeSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  x2: z.number(),
  y2: z.number(),
  width: z.number(),
  height: z.number(),
  objectType: canvasObjectTypeSchema,
  shape: canvasNodeShapeSchema,
  color: z.string().nullable(),
  strokeColor: z.string().nullable(),
  fillColor: z.string().nullable(),
  strokeWidth: z.number(),
  rotation: z.number(),
  sortOrder: z.number(),
  label: z.string(),
  imageUrl: z.string().nullable().optional(),
  maskJson: z.string().nullable().optional(),
  pointsJson: z.string().nullable().optional(),
  pointAx: z.number().nullable().optional(),
  pointAy: z.number().nullable().optional(),
  pointBx: z.number().nullable().optional(),
  pointBy: z.number().nullable().optional(),
  wallThickness: z.number().optional(),
  wallAngle: z.number().nullable().optional(),
});
export type IdeaCanvasThumbnailNode = z.infer<typeof ideaCanvasThumbnailNodeSchema>;

export const ideaCanvasThumbnailEdgeSchema = z.object({
  id: z.string(),
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  label: z.string().nullable(),
  style: canvasEdgeStyleSchema,
});
export type IdeaCanvasThumbnailEdge = z.infer<typeof ideaCanvasThumbnailEdgeSchema>;

export const ideaCanvasThumbnailSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  name: z.string(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  canvasMode: canvasModeSchema,
  nodes: z.array(ideaCanvasThumbnailNodeSchema),
  edges: z.array(ideaCanvasThumbnailEdgeSchema),
  updatedAt: z.string(),
});
export type IdeaCanvasThumbnail = z.infer<typeof ideaCanvasThumbnailSchema>;

export const createIdeaCanvasSchema = z.object({
  name: z.string().trim().min(1).max(200),
  entityType: z.string().max(50).optional(),
  entityId: z.string().optional(),
  canvasMode: canvasModeSchema.optional(),
});
export type CreateIdeaCanvasInput = z.input<typeof createIdeaCanvasSchema>;

export const updateIdeaCanvasSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  zoom: z.number().min(0.1).max(10).optional(),
  panX: z.number().optional(),
  panY: z.number().optional(),
});
export type UpdateIdeaCanvasInput = z.infer<typeof updateIdeaCanvasSchema>;

export const updateCanvasSettingsSchema = z.object({
  physicalWidth: z.number().positive().nullable().optional(),
  physicalHeight: z.number().positive().nullable().optional(),
  physicalUnit: canvasPhysicalUnitSchema.nullable().optional(),
  backgroundImageUrl: z.string().max(1000).nullable().optional(),
  backgroundImageOpacity: z.number().min(0).max(1).optional(),
  snapToGrid: z.boolean().optional(),
  gridSize: z.number().int().min(8).max(200).optional(),
  showDimensions: z.boolean().optional(),
  guides: z.array(canvasGuideSchema).optional(),
});
export type UpdateCanvasSettingsInput = z.infer<typeof updateCanvasSettingsSchema>;

export const createCanvasNodeSchema = z.object({
  label: z.string().trim().max(500).default(""),
  body: z.string().max(5000).optional(),
  entryId: z.string().optional(),
  x: z.number().default(0),
  y: z.number().default(0),
  x2: z.number().default(0),
  y2: z.number().default(0),
  width: z.number().min(1).max(2000).default(160),
  height: z.number().min(1).max(2000).default(80),
  color: z.string().max(30).optional(),
  strokeColor: z.string().max(30).optional(),
  fillColor: z.string().max(30).optional(),
  strokeWidth: z.number().int().min(1).max(20).default(1),
  shape: canvasNodeShapeSchema.default("rectangle"),
  objectType: canvasObjectTypeSchema.default("flowchart"),
  rotation: z.number().default(0),
  sortOrder: z.number().int().default(0),
  imageUrl: z.string().max(1000).optional().nullable(),
  maskJson: z.string().max(50000).optional().nullable(),
  // Building / floorplan fields
  wallThickness: z.number().positive().optional(),
  wallAngle: z.number().optional().nullable(),
  wallHeight: z.number().positive().optional().nullable(),
  physicalLength: z.number().optional().nullable(),
  parentNodeId: z.string().optional().nullable(),
  pointAx: z.number().optional().nullable(),
  pointAy: z.number().optional().nullable(),
  pointBx: z.number().optional().nullable(),
  pointBy: z.number().optional().nullable(),
  // Freehand / polyline data
  pointsJson: z.string().max(50000).optional().nullable(),
  // Layer assignment
  layerId: z.string().optional().nullable(),
});
export type CreateCanvasNodeInput = z.input<typeof createCanvasNodeSchema>;

export const updateCanvasNodeSchema = z.object({
  label: z.string().trim().max(500).optional(),
  body: z.string().max(5000).optional().nullable(),
  entryId: z.string().optional().nullable(),
  x: z.number().optional(),
  y: z.number().optional(),
  x2: z.number().optional(),
  y2: z.number().optional(),
  width: z.number().min(1).max(2000).optional(),
  height: z.number().min(1).max(2000).optional(),
  color: z.string().max(30).optional().nullable(),
  strokeColor: z.string().max(30).optional().nullable(),
  fillColor: z.string().max(30).optional().nullable(),
  strokeWidth: z.number().int().min(1).max(20).optional(),
  shape: canvasNodeShapeSchema.optional(),
  objectType: canvasObjectTypeSchema.optional(),
  rotation: z.number().optional(),
  sortOrder: z.number().int().optional(),
  imageUrl: z.string().max(1000).optional().nullable(),
  // Building / floorplan fields
  wallThickness: z.number().positive().optional().nullable(),
  wallAngle: z.number().optional().nullable(),
  wallHeight: z.number().positive().optional().nullable(),
  physicalLength: z.number().optional().nullable(),
  parentNodeId: z.string().optional().nullable(),
  pointAx: z.number().optional().nullable(),
  pointAy: z.number().optional().nullable(),
  pointBx: z.number().optional().nullable(),
  pointBy: z.number().optional().nullable(),
  // Freehand / polyline data
  pointsJson: z.string().max(50000).optional().nullable(),
  // Layer assignment
  layerId: z.string().optional().nullable(),
});
export type UpdateCanvasNodeInput = z.infer<typeof updateCanvasNodeSchema>;

export const batchUpdateCanvasNodesSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    x: z.number().optional(),
    y: z.number().optional(),
    x2: z.number().optional(),
    y2: z.number().optional(),
    width: z.number().min(1).max(2000).optional(),
    height: z.number().min(1).max(2000).optional(),
    wallAngle: z.number().optional().nullable(),
    sortOrder: z.number().int().optional(),
    layerId: z.string().optional().nullable(),
  })).min(1).max(200),
});
export type BatchUpdateCanvasNodesInput = z.infer<typeof batchUpdateCanvasNodesSchema>;

export const createCanvasEdgeSchema = z.object({
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  label: z.string().max(200).optional(),
  style: canvasEdgeStyleSchema.default("solid"),
});
export type CreateCanvasEdgeInput = z.input<typeof createCanvasEdgeSchema>;

export const updateCanvasEdgeSchema = z.object({
  label: z.string().max(200).optional().nullable(),
  style: canvasEdgeStyleSchema.optional(),
});
export type UpdateCanvasEdgeInput = z.infer<typeof updateCanvasEdgeSchema>;

// ─── Canvas Object Library ────────────────────────────────────────────────────

export const canvasObjectCategoryValues = [
  "vehicle", "furniture", "cabinet", "appliance", "structure",
  "tool", "person", "electronics", "custom",
] as const;
export const canvasObjectCategorySchema = z.enum(canvasObjectCategoryValues);
export type CanvasObjectCategory = z.infer<typeof canvasObjectCategorySchema>;

export const canvasObjectImageSourceValues = ["preset", "uploaded"] as const;
export const canvasObjectImageSourceSchema = z.enum(canvasObjectImageSourceValues);
export type CanvasObjectImageSource = z.infer<typeof canvasObjectImageSourceSchema>;

export const canvasObjectSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  name: z.string(),
  category: canvasObjectCategorySchema,
  imageSource: canvasObjectImageSourceSchema,
  presetKey: z.string().nullable(),
  attachmentId: z.string().nullable(),
  maskData: z.string().nullable(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CanvasObject = z.infer<typeof canvasObjectSchema>;

export const createCanvasObjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: canvasObjectCategorySchema,
  imageSource: canvasObjectImageSourceSchema,
  presetKey: z.string().max(200).optional().nullable(),
  attachmentId: z.string().max(30).optional().nullable(),
  maskData: z.string().optional().nullable(),
});
export type CreateCanvasObjectInput = z.infer<typeof createCanvasObjectSchema>;

export const updateCanvasObjectSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  category: canvasObjectCategorySchema.optional(),
  imageSource: canvasObjectImageSourceSchema.optional(),
  maskData: z.string().optional().nullable(),
  attachmentId: z.string().max(30).optional().nullable(),
});
export type UpdateCanvasObjectInput = z.infer<typeof updateCanvasObjectSchema>;

// ─── Layout Preferences ───

export const layoutItemSchema = z.object({
  i: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  minW: z.number().optional(),
  minH: z.number().optional(),
  maxW: z.number().optional(),
  maxH: z.number().optional(),
});
export type LayoutItem = z.infer<typeof layoutItemSchema>;

export const saveLayoutPreferenceSchema = z.object({
  entityType: z.string().max(50),
  entityId: z.string().max(50).optional().nullable(),
  layoutJson: z.array(z.record(z.string(), z.unknown())),
});
export type SaveLayoutPreferenceInput = z.infer<typeof saveLayoutPreferenceSchema>;

export const layoutPreferenceSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  layoutJson: z.array(z.record(z.string(), z.unknown())),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LayoutPreference = z.infer<typeof layoutPreferenceSchema>;

export const quickActionItemSchema = z.object({ i: z.string() });
export type QuickActionItem = z.infer<typeof quickActionItemSchema>;

export const createDashboardPinSchema = z.object({
  entityType: z.enum(["asset", "project", "hobby"]),
  entityId: z.string().min(1).max(50),
});
export type CreateDashboardPinInput = z.infer<typeof createDashboardPinSchema>;

export const dashboardPinSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  entityName: z.string(),
  entityStatus: z.string().nullable(),
  entityHref: z.string(),
  sortOrder: z.number(),
  createdAt: z.string(),
});
export type DashboardPin = z.infer<typeof dashboardPinSchema>;

// ── Overview Pins (item-level pins to entity overview tab) ─────────────────────

export const createOverviewPinSchema = z.object({
  entityType: z.string().min(1).max(50),
  entityId: z.string().min(1).max(50),
  itemType: z.enum(["canvas", "attachment"]),
  itemId: z.string().min(1).max(50),
});
export type CreateOverviewPinInput = z.infer<typeof createOverviewPinSchema>;

export const overviewPinSchema = z.object({
  id: z.string(),
  itemType: z.enum(["canvas", "attachment"]),
  itemId: z.string(),
  sortOrder: z.number(),
  createdAt: z.string(),
  canvas: z.object({
    id: z.string(),
    name: z.string(),
    canvasMode: z.string(),
    nodeCount: z.number(),
    edgeCount: z.number(),
    updatedAt: z.string(),
  }).nullable(),
  attachment: z.object({
    id: z.string(),
    originalFilename: z.string(),
    mimeType: z.string(),
    thumbnailKey: z.string().nullable(),
    caption: z.string().nullable(),
    storageKey: z.string(),
  }).nullable(),
});
export type OverviewPin = z.infer<typeof overviewPinSchema>;

// ── Idea Domain ─────────────────────────────────────────────────────

// Enum schemas
export const ideaStageSchema = z.enum(["spark", "developing", "ready"]);
export type IdeaStage = z.infer<typeof ideaStageSchema>;

export const ideaPrioritySchema = z.enum(["low", "medium", "high"]);
export type IdeaPriority = z.infer<typeof ideaPrioritySchema>;

export const ideaCategorySchema = z.enum([
  "home_improvement",
  "vehicle",
  "outdoor",
  "technology",
  "hobby_craft",
  "financial",
  "health",
  "travel",
  "learning",
  "other",
]);
export type IdeaCategory = z.infer<typeof ideaCategorySchema>;

export const ideaPromotionTargetSchema = z.enum(["project", "asset", "hobby"]);
export type IdeaPromotionTarget = z.infer<typeof ideaPromotionTargetSchema>;

// ── Idea JSON sub-schemas ───────────────────────────────────────────

export const ideaNoteItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.string(),
});
export type IdeaNoteItem = z.infer<typeof ideaNoteItemSchema>;

export const ideaLinkItemSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  label: z.string(),
  createdAt: z.string(),
});
export type IdeaLinkItem = z.infer<typeof ideaLinkItemSchema>;

export const ideaMaterialItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.string(),
  notes: z.string(),
});
export type IdeaMaterialItem = z.infer<typeof ideaMaterialItemSchema>;

export const ideaStepItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  done: z.boolean(),
});
export type IdeaStepItem = z.infer<typeof ideaStepItemSchema>;

// ── Idea response schema ────────────────────────────────────────────

export const ideaSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  stage: ideaStageSchema,
  priority: ideaPrioritySchema,
  category: ideaCategorySchema.nullable(),
  promotionTarget: ideaPromotionTargetSchema.nullable(),
  notes: z.array(ideaNoteItemSchema),
  links: z.array(ideaLinkItemSchema),
  materials: z.array(ideaMaterialItemSchema),
  steps: z.array(ideaStepItemSchema),
  promotedAt: z.string().nullable(),
  promotedToType: ideaPromotionTargetSchema.nullable(),
  promotedToId: z.string().nullable(),
  demotedFromType: ideaPromotionTargetSchema.nullable(),
  demotedFromId: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Idea = z.infer<typeof ideaSchema>;

export const ideaSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  stage: ideaStageSchema,
  priority: ideaPrioritySchema,
  category: ideaCategorySchema.nullable(),
  promotionTarget: ideaPromotionTargetSchema.nullable(),
  noteCount: z.number(),
  linkCount: z.number(),
  materialCount: z.number(),
  stepCount: z.number(),
  stepsCompleted: z.number(),
  promotedAt: z.string().nullable(),
  promotedToType: ideaPromotionTargetSchema.nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type IdeaSummary = z.infer<typeof ideaSummarySchema>;

// ── Idea input schemas ──────────────────────────────────────────────

export const createIdeaSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  stage: ideaStageSchema.optional(),
  priority: ideaPrioritySchema.optional(),
  category: ideaCategorySchema.optional(),
  promotionTarget: ideaPromotionTargetSchema.optional(),
  materials: z.array(z.object({
    name: z.string().min(1),
    quantity: z.string(),
    notes: z.string(),
  })).optional(),
  steps: z.array(z.object({
    label: z.string().min(1),
  })).optional(),
});
export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;

export const updateIdeaSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  stage: ideaStageSchema.optional(),
  priority: ideaPrioritySchema.optional(),
  category: ideaCategorySchema.nullable().optional(),
  promotionTarget: ideaPromotionTargetSchema.nullable().optional(),
  materials: z.array(ideaMaterialItemSchema).optional(),
  steps: z.array(ideaStepItemSchema).optional(),
  links: z.array(ideaLinkItemSchema).optional(),
});
export type UpdateIdeaInput = z.infer<typeof updateIdeaSchema>;

export const addIdeaNoteSchema = z.object({
  text: z.string().min(1).max(2000),
});
export type AddIdeaNoteInput = z.infer<typeof addIdeaNoteSchema>;

export const addIdeaLinkSchema = z.object({
  url: z.string().url(),
  label: z.string().min(1).max(200),
});
export type AddIdeaLinkInput = z.infer<typeof addIdeaLinkSchema>;

export const promoteIdeaSchema = z.object({
  target: ideaPromotionTargetSchema,
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
});
export type PromoteIdeaInput = z.infer<typeof promoteIdeaSchema>;

export const demoteToIdeaSchema = z.object({
  sourceType: ideaPromotionTargetSchema,
  sourceId: z.string(),
  title: z.string().min(1).max(200).optional(),
  stage: ideaStageSchema.optional(),
});
export type DemoteToIdeaInput = z.infer<typeof demoteToIdeaSchema>;

export const bulkMoveIdeasSchema = z.object({
  householdId: z.string().cuid(),
  ideaIds: z.array(z.string().cuid()).min(1).max(100),
  stage: ideaStageSchema
});

export const bulkArchiveIdeasSchema = z.object({
  householdId: z.string().cuid(),
  ideaIds: z.array(z.string().cuid()).min(1).max(100)
});

export const bulkDeleteIdeasSchema = z.object({
  householdId: z.string().cuid(),
  ideaIds: z.array(z.string().cuid()).min(1).max(100)
});

export const bulkSetIdeaPrioritySchema = z.object({
  householdId: z.string().cuid(),
  ideaIds: z.array(z.string().cuid()).min(1).max(100),
  priority: ideaPrioritySchema
});

export const bulkIdeaOperationResultSchema = z.object({
  succeeded: z.number(),
  failed: z.array(bulkFailedItemSchema)
});

// ── Delete Impact ────────────────────────────────────────────────────

export const assetDeleteImpactSchema = z.object({
  schedules: z.number().int(),
  logs: z.number().int(),
  entries: z.number().int(),
  comments: z.number().int(),
  transfers: z.number().int(),
});
export type AssetDeleteImpact = z.infer<typeof assetDeleteImpactSchema>;

export const projectDeleteImpactSchema = z.object({
  tasks: z.number().int(),
  phases: z.number().int(),
  expenses: z.number().int(),
  budgetCategories: z.number().int(),
  linkedAssets: z.number().int(),
  linkedInventoryItems: z.number().int(),
  comments: z.number().int(),
});
export type ProjectDeleteImpact = z.infer<typeof projectDeleteImpactSchema>;

export const inventoryDeleteImpactSchema = z.object({
  maintenanceLogParts: z.number().int(),
  projectPhaseSupplies: z.number().int(),
  hobbyRecipeIngredients: z.number().int(),
  hobbySessionIngredients: z.number().int(),
  assetLinks: z.number().int(),
});
export type InventoryDeleteImpact = z.infer<typeof inventoryDeleteImpactSchema>;

export const hobbyDeleteImpactSchema = z.object({
  sessions: z.number().int(),
  recipes: z.number().int(),
  series: z.number().int(),
  practiceGoals: z.number().int(),
  practiceRoutines: z.number().int(),
  metricDefinitions: z.number().int(),
  collectionItems: z.number().int(),
});
export type HobbyDeleteImpact = z.infer<typeof hobbyDeleteImpactSchema>;

// ── Trash (Recently Deleted) ─────────────────────────────────────────

export const trashItemTypeSchema = z.enum(["asset", "project", "inventory_item"]);
export type TrashItemType = z.infer<typeof trashItemTypeSchema>;

export const trashItemSchema = z.object({
  id: z.string().cuid(),
  type: trashItemTypeSchema,
  name: z.string(),
  deletedAt: z.string().datetime(),
  householdId: z.string().cuid(),
});
export type TrashItem = z.infer<typeof trashItemSchema>;

export const trashListResponseSchema = z.object({
  items: z.array(trashItemSchema),
  total: z.number().int(),
});
export type TrashListResponse = z.infer<typeof trashListResponseSchema>;

