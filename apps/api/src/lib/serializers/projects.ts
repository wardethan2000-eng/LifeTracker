import {
  projectAssetSchema,
  projectBudgetCategorySummarySchema,
  projectExpenseSchema,
  projectInventoryRollupSchema,
  projectNoteSchema,
  projectPortfolioItemSchema,
  projectPhaseChecklistItemSchema,
  projectPhaseDetailSchema,
  projectPhaseSchema,
  projectPhaseSummarySchema,
  projectPhaseSupplySchema,
  projectSchema,
  projectTaskChecklistItemSchema,
  projectTaskSchema
} from "@lifekeeper/types";
import { toShallowUserResponse } from "./users.js";

export const toProjectResponse = (project: {
  id: string;
  householdId: string;
  name: string;
  description: string | null;
  status: string;
  startDate: Date | null;
  targetEndDate: Date | null;
  actualEndDate: Date | null;
  budgetAmount: number | null;
  notes: string | null;
  parentProjectId: string | null;
  depth: number;
  createdAt: Date;
  updatedAt: Date;
}) => projectSchema.parse({
  id: project.id,
  householdId: project.householdId,
  name: project.name,
  description: project.description,
  status: project.status,
  startDate: project.startDate?.toISOString() ?? null,
  targetEndDate: project.targetEndDate?.toISOString() ?? null,
  actualEndDate: project.actualEndDate?.toISOString() ?? null,
  budgetAmount: project.budgetAmount,
  notes: project.notes,
  parentProjectId: project.parentProjectId,
  depth: project.depth,
  createdAt: project.createdAt.toISOString(),
  updatedAt: project.updatedAt.toISOString()
});

export const toProjectAssetResponse = (projectAsset: {
  id: string;
  projectId: string;
  assetId: string;
  relationship: string;
  role: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  asset?: { id: string; name: string; category: string } | null;
}) => projectAssetSchema.parse({
  id: projectAsset.id,
  projectId: projectAsset.projectId,
  assetId: projectAsset.assetId,
  relationship: projectAsset.relationship,
  role: projectAsset.role,
  notes: projectAsset.notes,
  asset: projectAsset.asset ?? undefined,
  createdAt: projectAsset.createdAt.toISOString(),
  updatedAt: projectAsset.updatedAt.toISOString()
});

export const toProjectPhaseChecklistItemResponse = (item: {
  id: string;
  phaseId: string;
  title: string;
  isCompleted: boolean;
  completedAt: Date | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
}) => projectPhaseChecklistItemSchema.parse({
  id: item.id,
  phaseId: item.phaseId,
  title: item.title,
  isCompleted: item.isCompleted,
  completedAt: item.completedAt?.toISOString() ?? null,
  sortOrder: item.sortOrder,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString()
});

export const toProjectTaskChecklistItemResponse = (item: {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  completedAt: Date | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
}) => projectTaskChecklistItemSchema.parse({
  id: item.id,
  taskId: item.taskId,
  title: item.title,
  isCompleted: item.isCompleted,
  completedAt: item.completedAt?.toISOString() ?? null,
  sortOrder: item.sortOrder,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString()
});

export const toProjectTaskResponse = (task: {
  id: string;
  projectId: string;
  phaseId: string | null;
  title: string;
  description: string | null;
  status: string;
  taskType?: string | null;
  isCompleted?: boolean | null;
  assignedToId: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  estimatedCost: number | null;
  actualCost: number | null;
  sortOrder: number | null;
  scheduleId: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: { id: string; displayName: string | null } | null;
  checklistItems?: Array<{
    id: string;
    taskId: string;
    title: string;
    isCompleted: boolean;
    completedAt: Date | null;
    sortOrder: number | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}) => projectTaskSchema.parse({
  id: task.id,
  projectId: task.projectId,
  phaseId: task.phaseId,
  title: task.title,
  description: task.description,
  status: task.status,
  taskType: task.taskType ?? "full",
  isCompleted: task.isCompleted ?? false,
  assignedToId: task.assignedToId,
  assignee: task.assignedTo ? toShallowUserResponse(task.assignedTo) : null,
  dueDate: task.dueDate?.toISOString() ?? null,
  completedAt: task.completedAt?.toISOString() ?? null,
  estimatedCost: task.estimatedCost,
  actualCost: task.actualCost,
  sortOrder: task.sortOrder,
  scheduleId: task.scheduleId,
  checklistItems: (task.checklistItems ?? []).map(toProjectTaskChecklistItemResponse),
  createdAt: task.createdAt.toISOString(),
  updatedAt: task.updatedAt.toISOString()
});

export const toProjectExpenseResponse = (expense: {
  id: string;
  projectId: string;
  phaseId: string | null;
  budgetCategoryId: string | null;
  description: string;
  amount: number;
  category: string | null;
  date: Date | null;
  taskId: string | null;
  serviceProviderId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => projectExpenseSchema.parse({
  id: expense.id,
  projectId: expense.projectId,
  phaseId: expense.phaseId,
  budgetCategoryId: expense.budgetCategoryId,
  description: expense.description,
  amount: expense.amount,
  category: expense.category,
  date: expense.date?.toISOString() ?? null,
  taskId: expense.taskId,
  serviceProviderId: expense.serviceProviderId,
  notes: expense.notes,
  createdAt: expense.createdAt.toISOString(),
  updatedAt: expense.updatedAt.toISOString()
});

export const toProjectBudgetCategoryResponse = (category: {
  id: string;
  projectId: string;
  name: string;
  budgetAmount: number | null;
  sortOrder: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  expenses?: { amount: number }[];
}) => projectBudgetCategorySummarySchema.parse({
  id: category.id,
  projectId: category.projectId,
  name: category.name,
  budgetAmount: category.budgetAmount,
  sortOrder: category.sortOrder,
  notes: category.notes,
  createdAt: category.createdAt.toISOString(),
  updatedAt: category.updatedAt.toISOString(),
  expenseCount: category.expenses?.length ?? 0,
  actualSpend: category.expenses?.reduce((sum, expense) => sum + expense.amount, 0) ?? 0
});

export const toProjectPhaseResponse = (phase: {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: string;
  sortOrder: number | null;
  startDate: Date | null;
  targetEndDate: Date | null;
  actualEndDate: Date | null;
  budgetAmount: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => projectPhaseSchema.parse({
  id: phase.id,
  projectId: phase.projectId,
  name: phase.name,
  description: phase.description,
  status: phase.status,
  sortOrder: phase.sortOrder,
  startDate: phase.startDate?.toISOString() ?? null,
  targetEndDate: phase.targetEndDate?.toISOString() ?? null,
  actualEndDate: phase.actualEndDate?.toISOString() ?? null,
  budgetAmount: phase.budgetAmount,
  notes: phase.notes,
  createdAt: phase.createdAt.toISOString(),
  updatedAt: phase.updatedAt.toISOString()
});

export const toProjectPhaseSummaryResponse = (phase: {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: string;
  sortOrder: number | null;
  startDate: Date | null;
  targetEndDate: Date | null;
  actualEndDate: Date | null;
  budgetAmount: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  tasks: { status: string }[];
  checklistItems: { isCompleted: boolean }[];
  supplies: { isProcured: boolean }[];
  expenses: { amount: number }[];
}) => projectPhaseSummarySchema.parse({
  ...toProjectPhaseResponse(phase),
  taskCount: phase.tasks.length,
  completedTaskCount: phase.tasks.filter((task) => task.status === "completed").length,
  checklistItemCount: phase.checklistItems.length,
  completedChecklistItemCount: phase.checklistItems.filter((item) => item.isCompleted).length,
  supplyCount: phase.supplies.length,
  procuredSupplyCount: phase.supplies.filter((supply) => supply.isProcured).length,
  expenseTotal: phase.expenses.reduce((sum, expense) => sum + expense.amount, 0)
});

export const toProjectPhaseDetailResponse = (phase: {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: string;
  sortOrder: number | null;
  startDate: Date | null;
  targetEndDate: Date | null;
  actualEndDate: Date | null;
  budgetAmount: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  tasks: Array<{
    id: string;
    projectId: string;
    phaseId: string | null;
    title: string;
    description: string | null;
    status: string;
    taskType?: string | null;
    isCompleted?: boolean | null;
    assignedToId: string | null;
    dueDate: Date | null;
    completedAt: Date | null;
    estimatedCost: number | null;
    actualCost: number | null;
    sortOrder: number | null;
    scheduleId: string | null;
    createdAt: Date;
    updatedAt: Date;
    assignedTo?: { id: string; displayName: string | null } | null;
    checklistItems?: Array<{
      id: string;
      taskId: string;
      title: string;
      isCompleted: boolean;
      completedAt: Date | null;
      sortOrder: number | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }>;
  checklistItems: Array<{
    id: string;
    phaseId: string;
    title: string;
    isCompleted: boolean;
    completedAt: Date | null;
    sortOrder: number | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  supplies: Array<{
    id: string;
    phaseId: string;
    name: string;
    description: string | null;
    quantityNeeded: number;
    quantityOnHand: number;
    unit: string;
    estimatedUnitCost: number | null;
    actualUnitCost: number | null;
    supplier: string | null;
    supplierUrl: string | null;
    isProcured: boolean;
    procuredAt: Date | null;
    isStaged: boolean;
    stagedAt: Date | null;
    inventoryItemId: string | null;
    notes: string | null;
    sortOrder: number | null;
    createdAt: Date;
    updatedAt: Date;
    inventoryItem?: {
      id: string;
      name: string;
      quantityOnHand: number;
      unit: string;
      unitCost: number | null;
    } | null;
  }>;
  expenses: Array<{
    id: string;
    projectId: string;
    phaseId: string | null;
    budgetCategoryId: string | null;
    description: string;
    amount: number;
    category: string | null;
    date: Date | null;
    taskId: string | null;
    serviceProviderId: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}) => projectPhaseDetailSchema.parse({
  ...toProjectPhaseSummaryResponse(phase),
  tasks: phase.tasks.map(toProjectTaskResponse),
  checklistItems: phase.checklistItems.map(toProjectPhaseChecklistItemResponse),
  supplies: phase.supplies.map(toProjectPhaseSupplyResponse),
  expenses: phase.expenses.map(toProjectExpenseResponse)
});

export const toProjectInventoryRollupResponse = (rollup: {
  projectId: string;
  inventoryLineCount: number;
  totalInventoryNeeded: number;
  totalInventoryAllocated: number;
  totalInventoryRemaining: number;
  plannedInventoryCost: number;
}) => projectInventoryRollupSchema.parse(rollup);

export const toProjectPortfolioItemResponse = (item: {
  id: string;
  householdId: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  targetEndDate: string | null;
  actualEndDate: string | null;
  budgetAmount: number | null;
  notes: string | null;
  parentProjectId: string | null;
  depth: number;
  createdAt: string;
  updatedAt: string;
  totalBudgeted: number | null;
  totalSpent: number;
  taskCount: number;
  completedTaskCount: number;
  phaseCount: number;
  completedPhaseCount: number;
  percentComplete: number;
  phaseProgress: Array<{
    name: string;
    status: string;
    taskCount: number;
    completedTaskCount: number;
  }>;
  inventoryLineCount: number;
  totalInventoryNeeded: number;
  totalInventoryAllocated: number;
  totalInventoryRemaining: number;
  plannedInventoryCost: number;
}) => projectPortfolioItemSchema.parse(item);

export const toProjectPhaseSupplyResponse = (supply: {
  id: string;
  phaseId: string;
  name: string;
  description: string | null;
  quantityNeeded: number;
  quantityOnHand: number;
  unit: string;
  estimatedUnitCost: number | null;
  actualUnitCost: number | null;
  supplier: string | null;
  supplierUrl: string | null;
  isProcured: boolean;
  procuredAt: Date | null;
  isStaged: boolean;
  stagedAt: Date | null;
  inventoryItemId: string | null;
  notes: string | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
  inventoryItem?: {
    id: string;
    name: string;
    quantityOnHand: number;
    unit: string;
    unitCost: number | null;
  } | null;
}) => projectPhaseSupplySchema.parse({
  id: supply.id,
  phaseId: supply.phaseId,
  name: supply.name,
  description: supply.description,
  quantityNeeded: supply.quantityNeeded,
  quantityOnHand: supply.quantityOnHand,
  unit: supply.unit,
  estimatedUnitCost: supply.estimatedUnitCost,
  actualUnitCost: supply.actualUnitCost,
  supplier: supply.supplier,
  supplierUrl: supply.supplierUrl,
  isProcured: supply.isProcured,
  procuredAt: supply.procuredAt?.toISOString() ?? null,
  isStaged: supply.isStaged,
  stagedAt: supply.stagedAt?.toISOString() ?? null,
  inventoryItemId: supply.inventoryItemId,
  inventoryItem: supply.inventoryItem
    ? {
        id: supply.inventoryItem.id,
        name: supply.inventoryItem.name,
        quantityOnHand: supply.inventoryItem.quantityOnHand,
        unit: supply.inventoryItem.unit,
        unitCost: supply.inventoryItem.unitCost
      }
    : null,
  notes: supply.notes,
  sortOrder: supply.sortOrder,
  createdAt: supply.createdAt.toISOString(),
  updatedAt: supply.updatedAt.toISOString()
});

export const toProjectNoteResponse = (note: {
  id: string;
  projectId: string;
  phaseId: string | null;
  title: string;
  body: string;
  url: string | null;
  category: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  isPinned: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { id: string; displayName: string | null } | null;
  phase?: { name: string } | null;
}) => projectNoteSchema.parse({
  id: note.id,
  projectId: note.projectId,
  phaseId: note.phaseId,
  title: note.title,
  body: note.body,
  url: note.url,
  category: note.category,
  attachmentUrl: note.attachmentUrl,
  attachmentName: note.attachmentName,
  isPinned: note.isPinned,
  createdById: note.createdById,
  createdBy: note.createdBy ? toShallowUserResponse(note.createdBy) : null,
  phaseName: note.phase?.name ?? null,
  createdAt: note.createdAt.toISOString(),
  updatedAt: note.updatedAt.toISOString()
});