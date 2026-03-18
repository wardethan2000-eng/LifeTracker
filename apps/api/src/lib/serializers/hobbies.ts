import type { Prisma } from "@prisma/client";
import {
  hobbyLogSchema,
  hobbyCollectionItemDetailSchema,
  hobbyCollectionItemMetricReadingSchema,
  hobbyCollectionItemSchema,
  hobbyCollectionItemSessionSchema,
  hobbyPracticeGoalDetailSchema,
  hobbyPracticeGoalProgressPointSchema,
  hobbyPracticeGoalSchema,
  hobbyPracticeGoalSummarySchema,
  hobbyPracticeRoutineComplianceSummarySchema,
  hobbyPracticeRoutineSchema,
  hobbyPracticeRoutineSummarySchema,
  hobbyProjectDetailSchema,
  hobbyProjectEntryCountSchema,
  hobbyProjectInventoryItemSchema,
  hobbyProjectInventoryLinkDetailSchema,
  hobbyProjectMilestoneSchema,
  hobbyProjectSchema,
  hobbyProjectSummarySchema,
  hobbyProjectWorkLogSchema,
  hobbySeriesSchema,
  hobbySeriesSummarySchema,
  hobbyDetailAssetLinkSchema,
  hobbyDetailInventoryLinkSchema,
  hobbyDetailProjectLinkSchema,
  hobbyInventoryCategorySchema,
  hobbyMetricDefinitionSchema,
  hobbyMetricReadingPageSchema,
  hobbyMetricReadingSchema,
  hobbyRecipeIngredientSchema,
  hobbyRecipeShoppingListSchema,
  hobbyRecipeSchema,
  hobbyRecipeSummarySchema,
  hobbyRecipeStepSchema,
  hobbySessionIngredientSchema,
  hobbySessionSchema,
  hobbySessionStepSchema,
  hobbySessionSummarySchema,
  hobbySummarySchema,
  hobbySchema,
  inventoryItemSummarySchema
} from "@lifekeeper/types";

export const toHobbyResponse = (hobby: {
  id: string;
  householdId: string;
  name: string;
  description: string | null;
  status: string;
  activityMode: string;
  hobbyType: string | null;
  lifecycleMode: string;
  customFields: Prisma.JsonValue;
  fieldDefinitions: Prisma.JsonValue;
  notes: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}) => hobbySchema.parse({
  id: hobby.id,
  householdId: hobby.householdId,
  name: hobby.name,
  description: hobby.description,
  status: hobby.status,
  activityMode: hobby.activityMode,
  hobbyType: hobby.hobbyType,
  lifecycleMode: hobby.lifecycleMode,
  customFields: hobby.customFields as Record<string, unknown>,
  fieldDefinitions: hobby.fieldDefinitions as unknown[],
  notes: hobby.notes,
  createdById: hobby.createdById,
  createdAt: hobby.createdAt.toISOString(),
  updatedAt: hobby.updatedAt.toISOString()
});

export const toHobbySummaryResponse = (hobby: {
  id: string;
  householdId: string;
  name: string;
  description: string | null;
  status: string;
  activityMode: string;
  hobbyType: string | null;
  lifecycleMode: string;
  customFields: Prisma.JsonValue;
  fieldDefinitions: Prisma.JsonValue;
  notes: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    recipes: number;
    sessions: number;
    assetLinks: number;
    inventoryLinks: number;
  };
  sessions: { status: string }[];
}) => hobbySummarySchema.parse({
  ...toHobbyResponse(hobby),
  recipeCount: hobby._count.recipes,
  sessionCount: hobby._count.sessions,
  activeSessionCount: hobby.sessions.filter((session) => session.status === "active").length,
  completedSessionCount: hobby.sessions.filter((session) => session.status === "completed").length,
  linkedAssetCount: hobby._count.assetLinks,
  linkedInventoryCount: hobby._count.inventoryLinks
});

export const toRecipeResponse = (recipe: {
  id: string;
  hobbyId: string;
  name: string;
  description: string | null;
  sourceType: string;
  styleCategory: string | null;
  customFields: Prisma.JsonValue;
  estimatedDuration: string | null;
  estimatedCost: number | null;
  yield: string | null;
  notes: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => hobbyRecipeSchema.parse({
  id: recipe.id,
  hobbyId: recipe.hobbyId,
  name: recipe.name,
  description: recipe.description,
  sourceType: recipe.sourceType,
  styleCategory: recipe.styleCategory,
  customFields: recipe.customFields as Record<string, unknown>,
  estimatedDuration: recipe.estimatedDuration,
  estimatedCost: recipe.estimatedCost,
  yield: recipe.yield,
  notes: recipe.notes,
  isArchived: recipe.isArchived,
  createdAt: recipe.createdAt.toISOString(),
  updatedAt: recipe.updatedAt.toISOString()
});

export const toRecipeSummaryResponse = (recipe: {
  id: string;
  hobbyId: string;
  name: string;
  description: string | null;
  sourceType: string;
  styleCategory: string | null;
  customFields: Prisma.JsonValue;
  estimatedDuration: string | null;
  estimatedCost: number | null;
  yield: string | null;
  notes: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    ingredients: number;
    steps: number;
    sessions: number;
  };
}) => hobbyRecipeSummarySchema.parse({
  ...toRecipeResponse(recipe),
  ingredientCount: recipe._count.ingredients,
  stepCount: recipe._count.steps,
  sessionCount: recipe._count.sessions
});

export const toIngredientResponse = (ingredient: {
  id: string;
  recipeId: string;
  inventoryItemId: string | null;
  name: string;
  quantity: number;
  unit: string;
  category: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) => hobbyRecipeIngredientSchema.parse({
  id: ingredient.id,
  recipeId: ingredient.recipeId,
  inventoryItemId: ingredient.inventoryItemId,
  name: ingredient.name,
  quantity: ingredient.quantity,
  unit: ingredient.unit,
  category: ingredient.category,
  notes: ingredient.notes,
  sortOrder: ingredient.sortOrder,
  createdAt: ingredient.createdAt.toISOString(),
  updatedAt: ingredient.updatedAt.toISOString()
});

export const toStepResponse = (step: {
  id: string;
  recipeId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  durationMinutes: number | null;
  stepType: string;
  createdAt: Date;
  updatedAt: Date;
}) => hobbyRecipeStepSchema.parse({
  id: step.id,
  recipeId: step.recipeId,
  title: step.title,
  description: step.description,
  sortOrder: step.sortOrder,
  durationMinutes: step.durationMinutes,
  stepType: step.stepType,
  createdAt: step.createdAt.toISOString(),
  updatedAt: step.updatedAt.toISOString()
});

export const toSessionResponse = (session: {
  id: string;
  hobbyId: string;
  recipeId: string | null;
  seriesId: string | null;
  routineId?: string | null;
  collectionItemId?: string | null;
  batchNumber: number | null;
  name: string;
  status: string;
  startDate: Date | null;
  completedDate: Date | null;
  durationMinutes?: number | null;
  pipelineStepId: string | null;
  customFields: Prisma.JsonValue;
  totalCost: number | null;
  rating: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => hobbySessionSchema.parse({
  id: session.id,
  hobbyId: session.hobbyId,
  recipeId: session.recipeId,
  seriesId: session.seriesId,
  routineId: session.routineId ?? null,
  collectionItemId: session.collectionItemId ?? null,
  batchNumber: session.batchNumber,
  name: session.name,
  status: session.status,
  startDate: session.startDate?.toISOString() ?? null,
  completedDate: session.completedDate?.toISOString() ?? null,
  durationMinutes: session.durationMinutes ?? null,
  pipelineStepId: session.pipelineStepId,
  customFields: session.customFields as Record<string, unknown>,
  totalCost: session.totalCost,
  rating: session.rating,
  notes: session.notes,
  createdAt: session.createdAt.toISOString(),
  updatedAt: session.updatedAt.toISOString()
});

export const toSessionSummaryResponse = (session: {
  id: string;
  hobbyId: string;
  recipeId: string | null;
  seriesId: string | null;
  batchNumber: number | null;
  name: string;
  status: string;
  startDate: Date | null;
  completedDate: Date | null;
  pipelineStepId: string | null;
  customFields: Prisma.JsonValue;
  totalCost: number | null;
  rating: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  recipe?: { name: string } | null;
  _count: {
    ingredients: number;
    steps: number;
    metricReadings: number;
    logs: number;
  };
  steps: { isCompleted: boolean }[];
}) => hobbySessionSummarySchema.parse({
  ...toSessionResponse(session),
  ingredientCount: session._count.ingredients,
  stepCount: session._count.steps,
  completedStepCount: session.steps.filter((step) => step.isCompleted).length,
  metricReadingCount: session._count.metricReadings,
  logCount: session._count.logs,
  recipeName: session.recipe?.name ?? null
});

export const toHobbySeriesResponse = (series: {
  id: string;
  hobbyId: string;
  householdId: string;
  name: string;
  description: string | null;
  status: string;
  batchCount: number;
  bestBatchSessionId: string | null;
  tags: Prisma.JsonValue;
  notes: string | null;
  coverImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => hobbySeriesSchema.parse({
  id: series.id,
  hobbyId: series.hobbyId,
  householdId: series.householdId,
  name: series.name,
  description: series.description,
  status: series.status,
  batchCount: series.batchCount,
  bestBatchSessionId: series.bestBatchSessionId,
  tags: Array.isArray(series.tags) ? series.tags : [],
  notes: series.notes,
  coverImageUrl: series.coverImageUrl,
  createdAt: series.createdAt.toISOString(),
  updatedAt: series.updatedAt.toISOString()
});

export const toHobbySeriesSummaryResponse = (series: {
  id: string;
  hobbyId: string;
  householdId: string;
  name: string;
  description: string | null;
  status: string;
  batchCount: number;
  bestBatchSessionId: string | null;
  tags: Prisma.JsonValue;
  notes: string | null;
  coverImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  bestBatchSession?: { name: string } | null;
  sessions?: Array<{ completedDate: Date | null; startDate: Date | null; createdAt: Date }>;
}) => hobbySeriesSummarySchema.parse({
  ...toHobbySeriesResponse(series),
  bestBatchSessionName: series.bestBatchSession?.name ?? null,
  lastSessionDate: series.sessions && series.sessions.length > 0
    ? series.sessions
      .map((session) => session.completedDate ?? session.startDate ?? session.createdAt)
      .sort((left, right) => right.getTime() - left.getTime())[0]?.toISOString() ?? null
    : null
});

export const toSessionIngredientResponse = (ingredient: {
  id: string;
  sessionId: string;
  recipeIngredientId: string | null;
  inventoryItemId: string | null;
  name: string;
  quantityUsed: number;
  unit: string;
  unitCost: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => hobbySessionIngredientSchema.parse({
  id: ingredient.id,
  sessionId: ingredient.sessionId,
  recipeIngredientId: ingredient.recipeIngredientId,
  inventoryItemId: ingredient.inventoryItemId,
  name: ingredient.name,
  quantityUsed: ingredient.quantityUsed,
  unit: ingredient.unit,
  unitCost: ingredient.unitCost,
  notes: ingredient.notes,
  createdAt: ingredient.createdAt.toISOString(),
  updatedAt: ingredient.updatedAt.toISOString()
});

export const toSessionStepResponse = (step: {
  id: string;
  sessionId: string;
  recipeStepId: string | null;
  title: string;
  description: string | null;
  sortOrder: number;
  isCompleted: boolean;
  completedAt: Date | null;
  durationMinutes: number | null;
  stepType?: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => hobbySessionStepSchema.parse({
  id: step.id,
  sessionId: step.sessionId,
  recipeStepId: step.recipeStepId,
  title: step.title,
  description: step.description,
  sortOrder: step.sortOrder,
  isCompleted: step.isCompleted,
  completedAt: step.completedAt?.toISOString() ?? null,
  durationMinutes: step.durationMinutes,
  stepType: step.stepType ?? "generic",
  notes: step.notes,
  createdAt: step.createdAt.toISOString(),
  updatedAt: step.updatedAt.toISOString()
});

export const toHobbyAssetLinkResponse = (link: {
  id: string;
  hobbyId: string;
  assetId: string;
  role: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  asset: {
    id: string;
    name: string;
    category: string;
  };
}) => hobbyDetailAssetLinkSchema.parse({
  id: link.id,
  hobbyId: link.hobbyId,
  assetId: link.assetId,
  role: link.role,
  notes: link.notes,
  asset: link.asset,
  createdAt: link.createdAt.toISOString(),
  updatedAt: link.updatedAt.toISOString()
});

export const toHobbyInventoryLinkResponse = (link: {
  id: string;
  hobbyId: string;
  inventoryItemId: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  inventoryItem: {
    id: string;
    name: string;
    quantityOnHand: number;
    unit: string;
  };
}) => hobbyDetailInventoryLinkSchema.parse({
  id: link.id,
  hobbyId: link.hobbyId,
  inventoryItemId: link.inventoryItemId,
  notes: link.notes,
  inventoryItem: link.inventoryItem,
  createdAt: link.createdAt.toISOString(),
  updatedAt: link.updatedAt.toISOString()
});

export const toHobbyProjectLinkResponse = (link: {
  id: string;
  hobbyId: string;
  projectId: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  project: {
    id: string;
    name: string;
    status: string;
  };
}) => hobbyDetailProjectLinkSchema.parse({
  id: link.id,
  hobbyId: link.hobbyId,
  projectId: link.projectId,
  notes: link.notes,
  project: link.project,
  createdAt: link.createdAt.toISOString(),
  updatedAt: link.updatedAt.toISOString()
});

export const toHobbyProjectResponse = (project: {
  id: string;
  hobbyId: string;
  householdId: string;
  createdById: string;
  name: string;
  description: string | null;
  status: string;
  startDate: Date | null;
  targetEndDate: Date | null;
  completedDate: Date | null;
  coverImageUrl: string | null;
  difficulty: string | null;
  notes: string | null;
  tags: Prisma.JsonValue;
  seriesId: string | null;
  batchNumber: number | null;
  createdAt: Date;
  updatedAt: Date;
}) => hobbyProjectSchema.parse({
  id: project.id,
  hobbyId: project.hobbyId,
  householdId: project.householdId,
  createdById: project.createdById,
  name: project.name,
  description: project.description,
  status: project.status,
  startDate: project.startDate?.toISOString() ?? null,
  targetEndDate: project.targetEndDate?.toISOString() ?? null,
  completedDate: project.completedDate?.toISOString() ?? null,
  coverImageUrl: project.coverImageUrl,
  difficulty: project.difficulty,
  notes: project.notes,
  tags: Array.isArray(project.tags) ? project.tags : [],
  seriesId: project.seriesId,
  batchNumber: project.batchNumber,
  createdAt: project.createdAt.toISOString(),
  updatedAt: project.updatedAt.toISOString()
});

export const toHobbyProjectMilestoneResponse = (milestone: {
  id: string;
  hobbyProjectId: string;
  name: string;
  description: string | null;
  status: string;
  sortOrder: number;
  targetDate: Date | null;
  completedDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => hobbyProjectMilestoneSchema.parse({
  id: milestone.id,
  hobbyProjectId: milestone.hobbyProjectId,
  name: milestone.name,
  description: milestone.description,
  status: milestone.status,
  sortOrder: milestone.sortOrder,
  targetDate: milestone.targetDate?.toISOString() ?? null,
  completedDate: milestone.completedDate?.toISOString() ?? null,
  notes: milestone.notes,
  createdAt: milestone.createdAt.toISOString(),
  updatedAt: milestone.updatedAt.toISOString()
});

export const toHobbyProjectWorkLogResponse = (workLog: {
  id: string;
  hobbyProjectId: string;
  milestoneId: string | null;
  date: Date;
  durationMinutes: number | null;
  description: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => hobbyProjectWorkLogSchema.parse({
  id: workLog.id,
  hobbyProjectId: workLog.hobbyProjectId,
  milestoneId: workLog.milestoneId,
  date: workLog.date.toISOString(),
  durationMinutes: workLog.durationMinutes,
  description: workLog.description,
  notes: workLog.notes,
  createdAt: workLog.createdAt.toISOString(),
  updatedAt: workLog.updatedAt.toISOString()
});

export const toHobbyProjectInventoryItemResponse = (link: {
  id: string;
  hobbyProjectId: string;
  inventoryItemId: string;
  quantityNeeded: number;
  quantityUsed: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => hobbyProjectInventoryItemSchema.parse({
  id: link.id,
  hobbyProjectId: link.hobbyProjectId,
  inventoryItemId: link.inventoryItemId,
  quantityNeeded: link.quantityNeeded,
  quantityUsed: link.quantityUsed,
  notes: link.notes,
  createdAt: link.createdAt.toISOString(),
  updatedAt: link.updatedAt.toISOString()
});

export const toHobbyProjectInventoryLinkDetailResponse = (link: {
  id: string;
  hobbyProjectId: string;
  inventoryItemId: string;
  quantityNeeded: number;
  quantityUsed: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  inventoryItem: {
    id: string;
    householdId: string;
    itemType: string;
    conditionStatus: string | null;
    name: string;
    partNumber: string | null;
    description: string | null;
    category: string | null;
    manufacturer: string | null;
    quantityOnHand: number;
    unit: string;
    reorderThreshold: number | null;
    reorderQuantity: number | null;
    preferredSupplier: string | null;
    supplierUrl: string | null;
    unitCost: number | null;
    storageLocation: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}) => hobbyProjectInventoryLinkDetailSchema.parse({
  ...toHobbyProjectInventoryItemResponse(link),
  inventoryItem: inventoryItemSummarySchema.parse({
    id: link.inventoryItem.id,
    householdId: link.inventoryItem.householdId,
    itemType: link.inventoryItem.itemType,
    conditionStatus: link.inventoryItem.conditionStatus,
    name: link.inventoryItem.name,
    partNumber: link.inventoryItem.partNumber,
    description: link.inventoryItem.description,
    category: link.inventoryItem.category,
    manufacturer: link.inventoryItem.manufacturer,
    quantityOnHand: link.inventoryItem.quantityOnHand,
    unit: link.inventoryItem.unit,
    reorderThreshold: link.inventoryItem.reorderThreshold,
    reorderQuantity: link.inventoryItem.reorderQuantity,
    preferredSupplier: link.inventoryItem.preferredSupplier,
    supplierUrl: link.inventoryItem.supplierUrl,
    unitCost: link.inventoryItem.unitCost,
    storageLocation: link.inventoryItem.storageLocation,
    notes: link.inventoryItem.notes,
    totalValue: (link.inventoryItem.unitCost ?? 0) * link.inventoryItem.quantityOnHand,
    lowStock: link.inventoryItem.reorderThreshold !== null && link.inventoryItem.reorderThreshold !== undefined
      ? link.inventoryItem.quantityOnHand <= link.inventoryItem.reorderThreshold
      : false,
    createdAt: link.inventoryItem.createdAt.toISOString(),
    updatedAt: link.inventoryItem.updatedAt.toISOString()
  }),
  quantityRemaining: link.quantityNeeded - link.quantityUsed
});

export const toHobbyProjectSummaryResponse = (
  project: Parameters<typeof toHobbyProjectResponse>[0],
  stats: {
    milestoneCount: number;
    completedMilestoneCount: number;
    completionPercentage: number;
    totalLoggedHours: number;
  }
) => hobbyProjectSummarySchema.parse({
  ...toHobbyProjectResponse(project),
  ...stats
});

export const toHobbyProjectEntryCountResponse = (entryCount: {
  entryType: string;
  count: number;
}) => hobbyProjectEntryCountSchema.parse(entryCount);

export const toHobbyProjectDetailResponse = (
  project: Parameters<typeof toHobbyProjectResponse>[0],
  detail: {
    milestones: Parameters<typeof toHobbyProjectMilestoneResponse>[0][];
    recentWorkLogs: Parameters<typeof toHobbyProjectWorkLogResponse>[0][];
    inventoryItems: Parameters<typeof toHobbyProjectInventoryLinkDetailResponse>[0][];
    totalLoggedHours: number;
    daysActive: number | null;
    milestoneCount: number;
    completedMilestoneCount: number;
    milestoneCompletionPercentage: number;
    entryCountsByType: Array<{ entryType: string; count: number }>;
  }
) => hobbyProjectDetailSchema.parse({
  ...toHobbyProjectResponse(project),
  milestones: detail.milestones.map(toHobbyProjectMilestoneResponse),
  recentWorkLogs: detail.recentWorkLogs.map(toHobbyProjectWorkLogResponse),
  inventoryItems: detail.inventoryItems.map(toHobbyProjectInventoryLinkDetailResponse),
  totalLoggedHours: detail.totalLoggedHours,
  daysActive: detail.daysActive,
  milestoneCount: detail.milestoneCount,
  completedMilestoneCount: detail.completedMilestoneCount,
  milestoneCompletionPercentage: detail.milestoneCompletionPercentage,
  entryCountsByType: detail.entryCountsByType.map(toHobbyProjectEntryCountResponse)
});

export const toHobbyPracticeGoalResponse = (goal: {
  id: string;
  hobbyId: string;
  householdId: string;
  createdById: string;
  name: string;
  description: string | null;
  goalType: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  metricDefinitionId: string | null;
  startDate: Date | null;
  targetDate: Date | null;
  status: string;
  tags: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) => hobbyPracticeGoalSchema.parse({
  id: goal.id,
  hobbyId: goal.hobbyId,
  householdId: goal.householdId,
  createdById: goal.createdById,
  name: goal.name,
  description: goal.description,
  goalType: goal.goalType,
  targetValue: goal.targetValue,
  currentValue: goal.currentValue,
  unit: goal.unit,
  metricDefinitionId: goal.metricDefinitionId,
  startDate: goal.startDate?.toISOString() ?? null,
  targetDate: goal.targetDate?.toISOString() ?? null,
  status: goal.status,
  tags: Array.isArray(goal.tags) ? goal.tags : [],
  createdAt: goal.createdAt.toISOString(),
  updatedAt: goal.updatedAt.toISOString(),
});

export const toHobbyPracticeGoalSummaryResponse = (
  goal: Parameters<typeof toHobbyPracticeGoalResponse>[0],
  progressPercentage: number,
) => hobbyPracticeGoalSummarySchema.parse({
  ...toHobbyPracticeGoalResponse(goal),
  progressPercentage,
});

export const toHobbyPracticeGoalProgressPointResponse = (point: {
  value: number;
  date: string;
  sourceType: "metric" | "session" | "manual";
  sourceId: string | null;
  label: string | null;
}) => hobbyPracticeGoalProgressPointSchema.parse(point);

export const toHobbyPracticeGoalDetailResponse = (
  goal: Parameters<typeof toHobbyPracticeGoalResponse>[0],
  detail: {
    progressPercentage: number;
    progressHistory: Array<Parameters<typeof toHobbyPracticeGoalProgressPointResponse>[0]>;
  },
) => hobbyPracticeGoalDetailSchema.parse({
  ...toHobbyPracticeGoalResponse(goal),
  progressPercentage: detail.progressPercentage,
  progressHistory: detail.progressHistory.map(toHobbyPracticeGoalProgressPointResponse),
});

export const toHobbyPracticeRoutineResponse = (routine: {
  id: string;
  hobbyId: string;
  householdId: string;
  createdById: string;
  name: string;
  description: string | null;
  targetDurationMinutes: number | null;
  targetFrequency: string;
  targetSessionsPerPeriod: number;
  isActive: boolean;
  currentStreak: number;
  longestStreak: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => hobbyPracticeRoutineSchema.parse({
  id: routine.id,
  hobbyId: routine.hobbyId,
  householdId: routine.householdId,
  createdById: routine.createdById,
  name: routine.name,
  description: routine.description,
  targetDurationMinutes: routine.targetDurationMinutes,
  targetFrequency: routine.targetFrequency,
  targetSessionsPerPeriod: routine.targetSessionsPerPeriod,
  isActive: routine.isActive,
  currentStreak: routine.currentStreak,
  longestStreak: routine.longestStreak,
  notes: routine.notes,
  createdAt: routine.createdAt.toISOString(),
  updatedAt: routine.updatedAt.toISOString(),
});

export const toHobbyPracticeRoutineSummaryResponse = (
  routine: Parameters<typeof toHobbyPracticeRoutineResponse>[0],
  detail: {
    adherenceRate: number;
    nextExpectedSessionDate: string | null;
  },
) => hobbyPracticeRoutineSummarySchema.parse({
  ...toHobbyPracticeRoutineResponse(routine),
  adherenceRate: detail.adherenceRate,
  nextExpectedSessionDate: detail.nextExpectedSessionDate,
});

export const toHobbyPracticeRoutineComplianceSummaryResponse = (summary: {
  routineId: string;
  startDate: string;
  endDate: string;
  periods: Array<{
    periodStart: string;
    periodEnd: string;
    expectedSessions: number;
    completedSessions: number;
    metTarget: boolean;
  }>;
  totalExpectedSessions: number;
  totalCompletedSessions: number;
  adherenceRate: number;
}) => hobbyPracticeRoutineComplianceSummarySchema.parse(summary);

export const toHobbyCollectionItemResponse = (item: {
  id: string;
  hobbyId: string;
  householdId: string;
  createdById: string;
  name: string;
  description: string | null;
  status: string;
  acquiredDate: Date | null;
  retiredDate: Date | null;
  coverImageUrl: string | null;
  location: string | null;
  customFields: Prisma.JsonValue;
  quantity: number;
  tags: Prisma.JsonValue;
  notes: string | null;
  parentItemId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => hobbyCollectionItemSchema.parse({
  id: item.id,
  hobbyId: item.hobbyId,
  householdId: item.householdId,
  createdById: item.createdById,
  name: item.name,
  description: item.description,
  status: item.status,
  acquiredDate: item.acquiredDate?.toISOString() ?? null,
  retiredDate: item.retiredDate?.toISOString() ?? null,
  coverImageUrl: item.coverImageUrl,
  location: item.location,
  customFields: item.customFields as Record<string, unknown>,
  quantity: item.quantity,
  tags: Array.isArray(item.tags) ? item.tags : [],
  notes: item.notes,
  parentItemId: item.parentItemId,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

export const toHobbyCollectionItemSessionResponse = (session: {
  id: string;
  hobbyId: string;
  recipeId: string | null;
  seriesId: string | null;
  routineId: string | null;
  collectionItemId: string | null;
  batchNumber: number | null;
  name: string;
  status: string;
  startDate: Date | null;
  completedDate: Date | null;
  durationMinutes: number | null;
  pipelineStepId: string | null;
  customFields: Prisma.JsonValue;
  totalCost: number | null;
  rating: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  recipeName: string | null;
  routineName: string | null;
}) => hobbyCollectionItemSessionSchema.parse({
  ...toSessionResponse(session),
  recipeName: session.recipeName,
  routineName: session.routineName,
});

export const toHobbyCollectionItemMetricReadingResponse = (reading: {
  id: string;
  metricDefinitionId: string;
  sessionId: string | null;
  value: number;
  readingDate: Date;
  notes: string | null;
  createdAt: Date;
  metricName: string;
  metricUnit: string;
  sessionName: string | null;
}) => hobbyCollectionItemMetricReadingSchema.parse({
  id: reading.id,
  metricDefinitionId: reading.metricDefinitionId,
  sessionId: reading.sessionId,
  value: reading.value,
  readingDate: reading.readingDate.toISOString(),
  notes: reading.notes,
  createdAt: reading.createdAt.toISOString(),
  metricName: reading.metricName,
  metricUnit: reading.metricUnit,
  sessionName: reading.sessionName,
});

export const toHobbyCollectionItemDetailResponse = (
  item: Parameters<typeof toHobbyCollectionItemResponse>[0],
  detail: {
    childItems: Parameters<typeof toHobbyCollectionItemResponse>[0][];
    sessionHistory: Parameters<typeof toHobbyCollectionItemSessionResponse>[0][];
    entryTimeline: unknown[];
    metricReadings: Parameters<typeof toHobbyCollectionItemMetricReadingResponse>[0][];
  },
) => hobbyCollectionItemDetailSchema.parse({
  ...toHobbyCollectionItemResponse(item),
  childItems: detail.childItems.map(toHobbyCollectionItemResponse),
  sessionHistory: detail.sessionHistory.map(toHobbyCollectionItemSessionResponse),
  entryTimeline: detail.entryTimeline,
  metricReadings: detail.metricReadings.map(toHobbyCollectionItemMetricReadingResponse),
});

export const toHobbyInventoryCategoryResponse = (category: {
  id: string;
  hobbyId: string;
  categoryName: string;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
}) => hobbyInventoryCategorySchema.parse({
  id: category.id,
  hobbyId: category.hobbyId,
  categoryName: category.categoryName,
  sortOrder: category.sortOrder,
  createdAt: category.createdAt.toISOString(),
  updatedAt: category.updatedAt.toISOString()
});

export const toHobbyMetricDefinitionResponse = (metric: {
  id: string;
  hobbyId: string;
  name: string;
  unit: string;
  description: string | null;
  metricType: string;
  createdAt: Date;
  updatedAt: Date;
}) => hobbyMetricDefinitionSchema.parse({
  id: metric.id,
  hobbyId: metric.hobbyId,
  name: metric.name,
  unit: metric.unit,
  description: metric.description,
  metricType: metric.metricType,
  createdAt: metric.createdAt.toISOString(),
  updatedAt: metric.updatedAt.toISOString()
});

export const toHobbyMetricReadingResponse = (reading: {
  id: string;
  metricDefinitionId: string;
  sessionId: string | null;
  value: number;
  readingDate: Date;
  notes: string | null;
  createdAt: Date;
}) => hobbyMetricReadingSchema.parse({
  id: reading.id,
  metricDefinitionId: reading.metricDefinitionId,
  sessionId: reading.sessionId,
  value: reading.value,
  readingDate: reading.readingDate.toISOString(),
  notes: reading.notes,
  createdAt: reading.createdAt.toISOString()
});

export const toHobbyMetricReadingPageResponse = (payload: {
  items: Array<{
    id: string;
    metricDefinitionId: string;
    sessionId: string | null;
    value: number;
    readingDate: Date;
    notes: string | null;
    createdAt: Date;
  }>;
  nextCursor: string | null;
}) => hobbyMetricReadingPageSchema.parse({
  items: payload.items.map(toHobbyMetricReadingResponse),
  nextCursor: payload.nextCursor
});

export const toHobbyRecipeShoppingListResponse = (payload: {
  recipeId: string;
  recipeName: string;
  items: Array<{
    ingredientId: string;
    ingredientName: string;
    quantityNeeded: number;
    quantityOnHand: number;
    deficit: number;
    unit: string;
    inventoryItemId: string | null;
    estimatedCost: number | null;
  }>;
  totalEstimatedCost: number | null;
}) => hobbyRecipeShoppingListSchema.parse(payload);

export const toLogResponse = (log: {
  id: string;
  hobbyId: string;
  sessionId: string | null;
  title: string | null;
  content: string;
  logDate: Date;
  logType: string;
  createdAt: Date;
  updatedAt: Date;
}) => hobbyLogSchema.parse({
  id: log.id,
  hobbyId: log.hobbyId,
  sessionId: log.sessionId,
  title: log.title,
  content: log.content,
  logDate: log.logDate.toISOString(),
  logType: log.logType,
  createdAt: log.createdAt.toISOString(),
  updatedAt: log.updatedAt.toISOString()
});