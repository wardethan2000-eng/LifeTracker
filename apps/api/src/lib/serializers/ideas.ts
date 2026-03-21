import type { Idea as PrismaIdea } from "@prisma/client";

type IdeaNoteItem = { id: string; text: string; createdAt: string };
type IdeaStepItem = { id: string; label: string; done: boolean };

export function toIdeaResponse(idea: PrismaIdea) {
  const notes = (idea.notes as unknown as IdeaNoteItem[]) ?? [];
  const links = (idea.links as unknown as unknown[]) ?? [];
  const materials = (idea.materials as unknown as unknown[]) ?? [];
  const steps = (idea.steps as unknown as IdeaStepItem[]) ?? [];

  return {
    id: idea.id,
    householdId: idea.householdId,
    title: idea.title,
    description: idea.description,
    stage: idea.stage,
    priority: idea.priority,
    category: idea.category,
    promotionTarget: idea.promotionTarget,
    notes,
    links,
    materials,
    steps,
    promotedAt: idea.promotedAt?.toISOString() ?? null,
    promotedToType: idea.promotedToType,
    promotedToId: idea.promotedToId,
    demotedFromType: idea.demotedFromType,
    demotedFromId: idea.demotedFromId,
    archivedAt: idea.archivedAt?.toISOString() ?? null,
    createdById: idea.createdById,
    createdAt: idea.createdAt.toISOString(),
    updatedAt: idea.updatedAt.toISOString(),
  };
}

export function toIdeaSummaryResponse(idea: PrismaIdea) {
  const notes = (idea.notes as unknown as IdeaNoteItem[]) ?? [];
  const links = (idea.links as unknown as unknown[]) ?? [];
  const materials = (idea.materials as unknown as unknown[]) ?? [];
  const steps = (idea.steps as unknown as IdeaStepItem[]) ?? [];

  return {
    id: idea.id,
    title: idea.title,
    description: idea.description,
    stage: idea.stage,
    priority: idea.priority,
    category: idea.category,
    promotionTarget: idea.promotionTarget,
    noteCount: notes.length,
    linkCount: links.length,
    materialCount: materials.length,
    stepCount: steps.length,
    stepsCompleted: steps.filter((s) => s.done).length,
    promotedAt: idea.promotedAt?.toISOString() ?? null,
    promotedToType: idea.promotedToType,
    archivedAt: idea.archivedAt?.toISOString() ?? null,
    createdAt: idea.createdAt.toISOString(),
    updatedAt: idea.updatedAt.toISOString(),
  };
}
