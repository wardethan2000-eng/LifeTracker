import type { Prisma } from "@prisma/client";
import {
  hobbyLogSchema,
  hobbyRecipeIngredientSchema,
  hobbyRecipeSchema,
  hobbyRecipeStepSchema,
  hobbySessionIngredientSchema,
  hobbySessionSchema,
  hobbySessionStepSchema,
  hobbySessionSummarySchema,
  hobbySummarySchema,
  hobbySchema
} from "@lifekeeper/types";

export const toHobbyResponse = (hobby: {
  id: string;
  householdId: string;
  name: string;
  description: string | null;
  status: string;
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
}) => hobbySessionSchema.parse({
  id: session.id,
  hobbyId: session.hobbyId,
  recipeId: session.recipeId,
  name: session.name,
  status: session.status,
  startDate: session.startDate?.toISOString() ?? null,
  completedDate: session.completedDate?.toISOString() ?? null,
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
  notes: step.notes,
  createdAt: step.createdAt.toISOString(),
  updatedAt: step.updatedAt.toISOString()
});

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