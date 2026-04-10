import type { Playbook, PlaybookItem, PlaybookRun, PlaybookRunItem, Asset, InventoryItem, Procedure, Space } from "@prisma/client";
import {
  playbookSchema,
  playbookSummarySchema,
  playbookItemSchema,
  playbookRunSchema,
  playbookRunItemSchema
} from "@aegis/types";

type PlaybookItemWithRelations = PlaybookItem & {
  asset?: Pick<Asset, "id" | "name" | "category"> | null;
  inventoryItem?: Pick<InventoryItem, "id" | "name"> | null;
  procedure?: Pick<Procedure, "id" | "title"> | null;
  space?: Pick<Space, "id" | "name"> | null;
};

export const toPlaybookItemResponse = (
  item: PlaybookItemWithRelations
) => playbookItemSchema.parse({
  id: item.id,
  playbookId: item.playbookId,
  sortOrder: item.sortOrder,
  label: item.label,
  notes: item.notes,
  assetId: item.assetId,
  inventoryItemId: item.inventoryItemId,
  procedureId: item.procedureId,
  spaceId: item.spaceId,
  asset: item.asset ? { id: item.asset.id, name: item.asset.name, category: item.asset.category } : null,
  inventoryItem: item.inventoryItem ? { id: item.inventoryItem.id, name: item.inventoryItem.name } : null,
  procedure: item.procedure ? { id: item.procedure.id, title: item.procedure.title } : null,
  space: item.space ? { id: item.space.id, name: item.space.name } : null,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString()
});

export const toPlaybookRunItemResponse = (
  item: PlaybookRunItem & { playbookItem?: PlaybookItemWithRelations }
) => playbookRunItemSchema.parse({
  id: item.id,
  runId: item.runId,
  playbookItemId: item.playbookItemId,
  isCompleted: item.isCompleted,
  completedAt: item.completedAt?.toISOString() ?? null,
  notes: item.notes,
  playbookItem: item.playbookItem ? toPlaybookItemResponse(item.playbookItem) : undefined,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString()
});

export const toPlaybookRunResponse = (
  run: PlaybookRun & { items?: (PlaybookRunItem & { playbookItem?: PlaybookItemWithRelations })[] }
) => playbookRunSchema.parse({
  id: run.id,
  playbookId: run.playbookId,
  title: run.title,
  startedAt: run.startedAt.toISOString(),
  completedAt: run.completedAt?.toISOString() ?? null,
  notes: run.notes,
  items: (run.items ?? []).map(toPlaybookRunItemResponse),
  createdAt: run.createdAt.toISOString(),
  updatedAt: run.updatedAt.toISOString()
});

export const toPlaybookResponse = (
  pb: Playbook & { items?: PlaybookItemWithRelations[] }
) => playbookSchema.parse({
  id: pb.id,
  householdId: pb.householdId,
  title: pb.title,
  description: pb.description,
  triggerMonth: pb.triggerMonth,
  triggerDay: pb.triggerDay,
  leadDays: pb.leadDays,
  isActive: pb.isActive,
  items: (pb.items ?? []).map(toPlaybookItemResponse),
  deletedAt: pb.deletedAt?.toISOString() ?? null,
  createdAt: pb.createdAt.toISOString(),
  updatedAt: pb.updatedAt.toISOString()
});

export const toPlaybookSummaryResponse = (
  pb: Playbook & { _count?: { items?: number }; runs?: { startedAt: Date }[] }
) => playbookSummarySchema.parse({
  id: pb.id,
  householdId: pb.householdId,
  title: pb.title,
  description: pb.description,
  triggerMonth: pb.triggerMonth,
  triggerDay: pb.triggerDay,
  leadDays: pb.leadDays,
  isActive: pb.isActive,
  itemCount: pb._count?.items ?? 0,
  lastRunAt: pb.runs?.[0]?.startedAt?.toISOString() ?? null,
  createdAt: pb.createdAt.toISOString(),
  updatedAt: pb.updatedAt.toISOString()
});
