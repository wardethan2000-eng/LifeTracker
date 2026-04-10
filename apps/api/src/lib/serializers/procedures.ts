import type { Procedure, ProcedureStep, ProcedureAsset, ProcedureTool, Asset, InventoryItem } from "@prisma/client";
import {
  procedureSchema,
  procedureStepSchema,
  procedureSummarySchema,
  procedureAssetSchema,
  procedureToolSchema
} from "@aegis/types";

export const toProcedureStepResponse = (
  step: Pick<ProcedureStep, "id" | "procedureId" | "sortOrder" | "instruction" | "notes" | "estimatedMinutes" | "warningText" | "createdAt" | "updatedAt">
) => procedureStepSchema.parse({
  ...step,
  createdAt: step.createdAt.toISOString(),
  updatedAt: step.updatedAt.toISOString()
});

export const toProcedureAssetResponse = (
  link: Pick<ProcedureAsset, "id" | "procedureId" | "assetId" | "createdAt"> & {
    asset?: Pick<Asset, "id" | "name" | "category"> | null;
  }
) => procedureAssetSchema.parse({
  id: link.id,
  procedureId: link.procedureId,
  assetId: link.assetId,
  asset: link.asset ? { id: link.asset.id, name: link.asset.name, category: link.asset.category } : undefined,
  createdAt: link.createdAt.toISOString()
});

export const toProcedureToolResponse = (
  tool: Pick<ProcedureTool, "id" | "procedureId" | "inventoryItemId" | "quantity" | "notes" | "createdAt" | "updatedAt"> & {
    inventoryItem?: Pick<InventoryItem, "id" | "name" | "unit"> | null;
  }
) => procedureToolSchema.parse({
  id: tool.id,
  procedureId: tool.procedureId,
  inventoryItemId: tool.inventoryItemId,
  quantity: tool.quantity,
  notes: tool.notes,
  inventoryItem: tool.inventoryItem ? { id: tool.inventoryItem.id, name: tool.inventoryItem.name, unit: tool.inventoryItem.unit } : undefined,
  createdAt: tool.createdAt.toISOString(),
  updatedAt: tool.updatedAt.toISOString()
});

export const toProcedureResponse = (
  proc: Pick<Procedure, "id" | "householdId" | "title" | "description" | "estimatedMinutes" | "version" | "isArchived" | "deletedAt" | "createdAt" | "updatedAt"> & {
    steps?: ProcedureStep[];
    assetLinks?: (ProcedureAsset & { asset?: Pick<Asset, "id" | "name" | "category"> | null })[];
    toolItems?: (ProcedureTool & { inventoryItem?: Pick<InventoryItem, "id" | "name" | "unit"> | null })[];
  }
) => procedureSchema.parse({
  id: proc.id,
  householdId: proc.householdId,
  title: proc.title,
  description: proc.description,
  estimatedMinutes: proc.estimatedMinutes,
  version: proc.version,
  isArchived: proc.isArchived,
  steps: (proc.steps ?? []).map(toProcedureStepResponse),
  assetLinks: (proc.assetLinks ?? []).map(toProcedureAssetResponse),
  toolItems: (proc.toolItems ?? []).map(toProcedureToolResponse),
  deletedAt: proc.deletedAt?.toISOString() ?? null,
  createdAt: proc.createdAt.toISOString(),
  updatedAt: proc.updatedAt.toISOString()
});

export const toProcedureSummaryResponse = (
  proc: Pick<Procedure, "id" | "householdId" | "title" | "description" | "estimatedMinutes" | "version" | "isArchived" | "createdAt" | "updatedAt"> & {
    _count?: { steps?: number; assetLinks?: number };
  }
) => procedureSummarySchema.parse({
  id: proc.id,
  householdId: proc.householdId,
  title: proc.title,
  description: proc.description,
  estimatedMinutes: proc.estimatedMinutes,
  version: proc.version,
  isArchived: proc.isArchived,
  stepCount: proc._count?.steps ?? 0,
  assetCount: proc._count?.assetLinks ?? 0,
  createdAt: proc.createdAt.toISOString(),
  updatedAt: proc.updatedAt.toISOString()
});
