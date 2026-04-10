import {
  createAssetSchema,
  createHobbySessionInputSchema,
  createInventoryItemSchema,
  createMaintenanceLogPartSchema,
  createMaintenanceLogSchema,
  createSpaceInputSchema,
  createProjectSchema,
  failureSeverityValues,
  spaceTypeSchema,
  updateInventoryItemSchema
} from "@aegis/types";
import { z } from "zod";

import { normalizeExternalUrl } from "../url";

const dateInputPattern = /^\d{4}-\d{2}-\d{2}$/;
const dateTimeLocalPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const optionalTrimmedText = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, schema.optional());

const optionalNullableTrimmedText = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}, schema.nullable().optional());

const optionalNumberInput = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((value) => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}, schema.optional());

const requiredNumberInput = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((value) => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}, schema);

const optionalDateInput = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().regex(dateInputPattern, "Enter a valid date.").optional());

const optionalDateTimeLocalInput = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().regex(dateTimeLocalPattern, "Enter a valid date and time.").optional());

const normalizedUrlInput = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    return undefined;
  }

  const normalized = normalizeExternalUrl(trimmed);
  return normalized ?? trimmed;
}, z.string().url("Supplier Link must be a valid URL.").max(1000).optional());

const hobbySessionIdField = z.string().cuid().or(z.literal(""));

export const hobbySessionFormSchema = createHobbySessionInputSchema.extend({
  recipeId: hobbySessionIdField.optional().default(""),
  routineId: hobbySessionIdField.optional().default(""),
  collectionItemId: hobbySessionIdField.optional().default(""),
  startDate: optionalDateInput,
  notes: optionalTrimmedText(createHobbySessionInputSchema.shape.notes.unwrap()),
  seriesChoice: z.string().default(""),
  newSeriesName: optionalTrimmedText(z.string().min(1).max(200)),
  newSeriesDescription: optionalTrimmedText(z.string().max(2000)),
  newSeriesTags: optionalTrimmedText(z.string().max(500))
}).superRefine((value, context) => {
  if (value.seriesChoice === "__new__" && !value.newSeriesName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a name for the new series.",
      path: ["newSeriesName"]
    });
  }
});

const inventoryConditionField = optionalNullableTrimmedText(z.enum(["good", "fair", "needs_repair", "needs_replacement"]));

export const inventoryItemFormSchema = updateInventoryItemSchema.extend({
  name: optionalTrimmedText(createInventoryItemSchema.shape.name),
  itemType: createInventoryItemSchema.shape.itemType.default("consumable"),
  conditionStatus: inventoryConditionField,
  partNumber: optionalTrimmedText(createInventoryItemSchema.shape.partNumber.unwrap()),
  description: optionalTrimmedText(createInventoryItemSchema.shape.description.unwrap()),
  category: optionalTrimmedText(createInventoryItemSchema.shape.category.unwrap()),
  manufacturer: optionalTrimmedText(createInventoryItemSchema.shape.manufacturer.unwrap()),
  unit: optionalTrimmedText(createInventoryItemSchema.shape.unit),
  quantityOnHand: optionalNumberInput(createInventoryItemSchema.shape.quantityOnHand),
  reorderThreshold: optionalNumberInput(createInventoryItemSchema.shape.reorderThreshold.unwrap()),
  reorderQuantity: optionalNumberInput(createInventoryItemSchema.shape.reorderQuantity.unwrap()),
  preferredSupplier: optionalTrimmedText(createInventoryItemSchema.shape.preferredSupplier.unwrap()),
  supplierUrl: normalizedUrlInput,
  unitCost: optionalNumberInput(createInventoryItemSchema.shape.unitCost.unwrap()),
  storageLocation: optionalTrimmedText(createInventoryItemSchema.shape.storageLocation.unwrap()),
  notes: optionalTrimmedText(createInventoryItemSchema.shape.notes.unwrap()),
  imageUrl: normalizedUrlInput,
  expiresAt: z.string().default("").transform((v) => v.trim() || null)
}).superRefine((value, context) => {
  if (!value.name) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Name is required.",
      path: ["name"]
    });
  }

  if (value.itemType === "equipment") {
    if (value.reorderThreshold !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Reorder fields are only available for consumables.",
        path: ["reorderThreshold"]
      });
    }

    if (value.reorderQuantity !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Reorder fields are only available for consumables.",
        path: ["reorderQuantity"]
      });
    }
  }
});

export const spaceFormSchema = createSpaceInputSchema.extend({
  name: createSpaceInputSchema.shape.name,
  type: spaceTypeSchema,
  parentSpaceId: z.string().cuid().or(z.literal("")),
  description: optionalTrimmedText(createSpaceInputSchema.shape.description.unwrap()),
  notes: optionalTrimmedText(createSpaceInputSchema.shape.notes.unwrap()),
  sortOrder: optionalNumberInput(z.number().int())
});

export const maintenanceLogPartFormSchema = createMaintenanceLogPartSchema.extend({
  name: z.string(),
  partNumber: optionalTrimmedText(createMaintenanceLogPartSchema.shape.partNumber.unwrap()),
  quantity: z.union([z.literal(""), requiredNumberInput(createMaintenanceLogPartSchema.shape.quantity)]),
  unitCost: z.union([z.literal(""), optionalNumberInput(createMaintenanceLogPartSchema.shape.unitCost.unwrap())]),
  supplier: optionalTrimmedText(createMaintenanceLogPartSchema.shape.supplier.unwrap()),
  notes: optionalTrimmedText(createMaintenanceLogPartSchema.shape.notes.unwrap())
}).superRefine((value, context) => {
  const hasContent = value.name.trim().length > 0
    || value.partNumber !== undefined
    || value.quantity !== ""
    || value.unitCost !== ""
    || value.supplier !== undefined
    || value.notes !== undefined;

  if (!hasContent) {
    return;
  }

  if (value.name.trim().length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Part name is required when adding a part.",
      path: ["name"]
    });
  }
});

export const maintenanceLogFormSchema = createMaintenanceLogSchema.extend({
  scheduleId: z.string().cuid().or(z.literal("")),
  serviceProviderId: z.string().cuid().or(z.literal("")).optional(),
  title: optionalTrimmedText(createMaintenanceLogSchema.shape.title.unwrap()),
  notes: optionalTrimmedText(createMaintenanceLogSchema.shape.notes.unwrap()),
  completedAt: optionalDateTimeLocalInput,
  usageValue: optionalNumberInput(createMaintenanceLogSchema.shape.usageValue.unwrap()),
  cost: optionalNumberInput(createMaintenanceLogSchema.shape.cost.unwrap()),
  laborHours: optionalNumberInput(createMaintenanceLogSchema.shape.laborHours.unwrap()),
  laborRate: optionalNumberInput(createMaintenanceLogSchema.shape.laborRate.unwrap()),
  difficultyRating: optionalNumberInput(createMaintenanceLogSchema.shape.difficultyRating.unwrap()),
  performedBy: optionalTrimmedText(createMaintenanceLogSchema.shape.performedBy.unwrap()),
  failureMode: optionalTrimmedText(createMaintenanceLogSchema.shape.failureMode.unwrap()),
  symptom: optionalTrimmedText(createMaintenanceLogSchema.shape.symptom.unwrap()),
  rootCause: optionalTrimmedText(createMaintenanceLogSchema.shape.rootCause.unwrap()),
  severity: z.enum(["", ...failureSeverityValues]).transform((v) => v === "" ? undefined : v).pipe(z.enum(failureSeverityValues).optional()),
  isRepeatFailure: z.boolean().default(false),
  relatedLogId: z.string().cuid().or(z.literal("")).optional(),
  applyLinkedParts: z.boolean().default(true),
  parts: z.array(maintenanceLogPartFormSchema).default([])
});

export const projectFormSchema = createProjectSchema.extend({
  description: optionalTrimmedText(createProjectSchema.shape.description.unwrap()),
  startDate: optionalDateInput,
  targetEndDate: optionalDateInput,
  budgetAmount: optionalNumberInput(createProjectSchema.shape.budgetAmount.unwrap()),
  notes: optionalTrimmedText(createProjectSchema.shape.notes.unwrap()),
  parentProjectId: z.string().cuid().or(z.literal("")).optional(),
  suggestedPhasesJson: z.string().optional(),
  templateKey: z.string().optional()
}).superRefine((value, context) => {
  if (value.startDate && value.targetEndDate && value.startDate > value.targetEndDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Target end date must be on or after the start date.",
      path: ["targetEndDate"]
    });
  }
});

export const assetProfileFormSchema = createAssetSchema.extend({
  name: createAssetSchema.shape.name,
  category: createAssetSchema.shape.category,
  visibility: createAssetSchema.shape.visibility,
  purchaseDate: optionalDateInput,
  description: optionalTrimmedText(createAssetSchema.shape.description.unwrap()),
  manufacturer: optionalTrimmedText(createAssetSchema.shape.manufacturer.unwrap()),
  model: optionalTrimmedText(createAssetSchema.shape.model.unwrap()),
  serialNumber: optionalTrimmedText(createAssetSchema.shape.serialNumber.unwrap()),
  parentAssetId: z.string().cuid().or(z.literal("")).optional(),
  conditionScore: optionalNumberInput(z.number().int().min(1).max(10)),
  saveAsPreset: z.boolean().default(false),
  presetLabel: optionalTrimmedText(z.string().min(1).max(160)),
  presetDescription: optionalTrimmedText(z.string().max(2000)),
  presetTags: optionalTrimmedText(z.string().max(500)),
  householdId: z.string().cuid(),
  fieldDefinitionsJson: z.string().min(2),
  fieldValuesJson: z.string().min(2),
  metricDraftsJson: z.string().min(2),
  scheduleDraftsJson: z.string().min(2)
}).superRefine((value, context) => {
  if (value.saveAsPreset && !value.presetLabel) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Template name is required when saving a reusable template.",
      path: ["presetLabel"]
    });
  }
});

export type HobbySessionFormValues = z.input<typeof hobbySessionFormSchema>;
export type HobbySessionResolvedValues = z.output<typeof hobbySessionFormSchema>;
export type InventoryItemFormValues = z.input<typeof inventoryItemFormSchema>;
export type InventoryItemResolvedValues = z.output<typeof inventoryItemFormSchema>;
export type SpaceFormValues = z.input<typeof spaceFormSchema>;
export type SpaceFormResolvedValues = z.output<typeof spaceFormSchema>;
export type MaintenanceLogFormValues = z.input<typeof maintenanceLogFormSchema>;
export type MaintenanceLogResolvedValues = z.output<typeof maintenanceLogFormSchema>;
export type MaintenanceLogPartFormValues = z.input<typeof maintenanceLogPartFormSchema>;
export type MaintenanceLogPartResolvedValues = z.output<typeof maintenanceLogPartFormSchema>;
export type ProjectFormValues = z.input<typeof projectFormSchema>;
export type ProjectResolvedValues = z.output<typeof projectFormSchema>;
export type AssetProfileFormValues = z.input<typeof assetProfileFormSchema>;
export type AssetProfileResolvedValues = z.output<typeof assetProfileFormSchema>;