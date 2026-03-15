import type { Prisma } from "@prisma/client";
import type { HobbyPreset } from "@lifekeeper/types";
import { hobbyPresetLibrary } from "@lifekeeper/presets";

type PrismaExecutor = Prisma.TransactionClient;

export type HobbyPresetDefinition = {
  fieldDefinitions: unknown[];
  customFieldDefaults: Record<string, unknown>;
  metrics: Array<{
    name: string;
    unit: string;
    description?: string;
    metricType?: string;
  }>;
  pipeline?: Array<{
    label: string;
    sortOrder: number;
    color?: string;
    isFinal?: boolean;
  }>;
  inventoryCategories?: Array<{
    categoryName: string;
    sortOrder?: number;
  }>;
  recipes?: Array<{
    name: string;
    description?: string;
    sourceType?: string;
    styleCategory?: string;
    customFields?: Record<string, unknown>;
    estimatedDuration?: string;
    estimatedCost?: number;
    yield?: string;
    notes?: string;
    ingredients?: Array<{
      name: string;
      quantity: number;
      unit: string;
      category?: string;
      notes?: string;
      sortOrder?: number;
    }>;
    steps?: Array<{
      title: string;
      description?: string;
      sortOrder?: number;
      durationMinutes?: number;
      stepType?: string;
    }>;
  }>;
};

export const applyHobbyPreset = async (
  prisma: PrismaExecutor,
  hobbyId: string,
  preset: HobbyPresetDefinition
): Promise<void> => {
  await prisma.hobby.update({
    where: { id: hobbyId },
    data: {
      fieldDefinitions: preset.fieldDefinitions as Prisma.InputJsonValue,
      customFields: preset.customFieldDefaults as Prisma.InputJsonValue,
    }
  });

  if (preset.metrics.length > 0) {
    await prisma.hobbyMetricDefinition.createMany({
      data: preset.metrics.map((m) => ({
        hobbyId,
        name: m.name,
        unit: m.unit,
        description: m.description ?? null,
        metricType: m.metricType ?? "numeric",
      }))
    });
  }

  if (preset.pipeline && preset.pipeline.length > 0) {
    await prisma.hobbySessionStatusStep.createMany({
      data: preset.pipeline.map((s) => ({
        hobbyId,
        label: s.label,
        sortOrder: s.sortOrder,
        color: s.color ?? null,
        isFinal: s.isFinal ?? false,
      }))
    });
  }

  if (preset.inventoryCategories && preset.inventoryCategories.length > 0) {
    await prisma.hobbyInventoryCategory.createMany({
      data: preset.inventoryCategories.map((c) => ({
        hobbyId,
        categoryName: c.categoryName,
        sortOrder: c.sortOrder ?? null,
      }))
    });
  }

  if (preset.recipes && preset.recipes.length > 0) {
    for (const recipe of preset.recipes) {
      const created = await prisma.hobbyRecipe.create({
        data: {
          hobbyId,
          name: recipe.name,
          description: recipe.description ?? null,
          sourceType: (recipe.sourceType as "preset" | "user" | "imported") ?? "preset",
          styleCategory: recipe.styleCategory ?? null,
          customFields: (recipe.customFields ?? {}) as Prisma.InputJsonValue,
          estimatedDuration: recipe.estimatedDuration ?? null,
          estimatedCost: recipe.estimatedCost ?? null,
          yield: recipe.yield ?? null,
          notes: recipe.notes ?? null,
        }
      });

      if (recipe.ingredients && recipe.ingredients.length > 0) {
        await prisma.hobbyRecipeIngredient.createMany({
          data: recipe.ingredients.map((ing, idx) => ({
            recipeId: created.id,
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            category: ing.category ?? null,
            notes: ing.notes ?? null,
            sortOrder: ing.sortOrder ?? idx,
          }))
        });
      }

      if (recipe.steps && recipe.steps.length > 0) {
        await prisma.hobbyRecipeStep.createMany({
          data: recipe.steps.map((step, idx) => ({
            recipeId: created.id,
            title: step.title,
            description: step.description ?? null,
            sortOrder: step.sortOrder ?? idx,
            durationMinutes: step.durationMinutes ?? null,
            stepType: step.stepType ?? "generic",
          }))
        });
      }
    }
  }
};

export const getHobbyPresetLibrary = (): HobbyPreset[] => hobbyPresetLibrary;

export const findHobbyPreset = (key: string): HobbyPreset | undefined =>
  hobbyPresetLibrary.find((p) => p.key === key);

export const hobbyPresetToDefinition = (preset: HobbyPreset): HobbyPresetDefinition => ({
  fieldDefinitions: preset.suggestedCustomFields,
  customFieldDefaults: {},
  metrics: preset.metricTemplates.map((m) => ({
    name: m.name,
    unit: m.unit,
    metricType: m.metricType,
    ...(m.description != null ? { description: m.description } : {}),
  })),
  pipeline: preset.pipelineSteps.map((s) => ({
    label: s.label,
    sortOrder: s.sortOrder,
    isFinal: s.isFinal,
    ...(s.color != null ? { color: s.color } : {}),
  })),
  inventoryCategories: preset.inventoryCategories.map((name, idx) => ({
    categoryName: name,
    sortOrder: idx,
  })),
  recipes: preset.starterRecipes.map((r) => ({
    name: r.name,
    sourceType: "preset" as const,
    customFields: r.customFields,
    ...(r.description != null ? { description: r.description } : {}),
    ...(r.styleCategory != null ? { styleCategory: r.styleCategory } : {}),
    ingredients: r.ingredients.map((ing, idx) => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      sortOrder: idx,
      ...(ing.category != null ? { category: ing.category } : {}),
      ...(ing.notes != null ? { notes: ing.notes } : {}),
    })),
    steps: r.steps.map((step, idx) => ({
      title: step.title,
      sortOrder: idx,
      stepType: step.stepType,
      ...(step.description != null ? { description: step.description } : {}),
      ...(step.durationMinutes != null ? { durationMinutes: step.durationMinutes } : {}),
    })),
  })),
});
