import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined),
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) }))
}));

vi.mock("../src/lib/search-index.js", () => ({
  syncProjectToSearchIndex: vi.fn(async () => undefined),
  removeSearchIndexEntry: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/queues.js", () => ({
  enqueueNotificationScan: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/project-status.js", () => ({
  syncProjectDerivedStatuses: vi.fn(async () => undefined),
  getPhaseCompletionSummary: vi.fn(async () => ({
    taskCount: 0,
    completedTaskCount: 0,
    checklistItemCount: 0,
    completedChecklistItemCount: 0
  })),
  buildPhaseCompletionGuardrailMessage: vi.fn(() => ""),
  getProjectCompletionSummary: vi.fn(async () => ({ taskCount: 0, completedTaskCount: 0, phaseCount: 0, completedPhaseCount: 0 })),
  buildProjectCompletionGuardrailMessage: vi.fn(() => "")
}));

vi.mock("../src/lib/inventory.js", () => ({
  applyInventoryTransaction: vi.fn(async () => undefined),
  getHouseholdInventoryItem: vi.fn(async () => null),
  InventoryError: class InventoryError extends Error { code = "unknown"; }
}));

import { errorHandlerPlugin } from "../src/plugins/error-handler.js";
import { projectPhaseRoutes } from "../src/routes/projects/phases.js";

const householdId = "clkeeperhouse000000000001";
const projectId = "clkeeperproject0000000001";
const phaseId = "clkeeperphase00000000001";
const categoryId = "clkeeperbudgetcat00000001";
const supplyId = "clkeepersupply0000000001";
const userId = "clkeeperuser0000000000001";

type PhaseRecord = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: string;
  sortOrder: number;
  startDate: Date | null;
  targetEndDate: Date | null;
  actualEndDate: Date | null;
  budgetAmount: number | null;
  notes: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type BudgetCategoryRecord = {
  id: string;
  projectId: string;
  name: string;
  budgetAmount: number | null;
  sortOrder: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SupplyRecord = {
  id: string;
  phaseId: string;
  projectId: string;
  name: string;
  category: string | null;
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
  sortOrder: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const buildPhaseRecord = (overrides: Partial<PhaseRecord> = {}): PhaseRecord => ({
  id: phaseId,
  projectId,
  name: "Demo Phase",
  description: null,
  status: "pending",
  sortOrder: 0,
  startDate: null,
  targetEndDate: null,
  actualEndDate: null,
  budgetAmount: null,
  notes: null,
  deletedAt: null,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  ...overrides
});

const buildBudgetCategoryRecord = (overrides: Partial<BudgetCategoryRecord> = {}): BudgetCategoryRecord => ({
  id: categoryId,
  projectId,
  name: "Materials",
  budgetAmount: null,
  sortOrder: 0,
  notes: null,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  ...overrides
});

const buildSupplyRecord = (overrides: Partial<SupplyRecord> = {}): SupplyRecord => ({
  id: supplyId,
  phaseId,
  projectId,
  name: "Lumber 2x4",
  category: null,
  description: null,
  quantityNeeded: 10,
  quantityOnHand: 0,
  unit: "each",
  estimatedUnitCost: null,
  actualUnitCost: null,
  supplier: null,
  supplierUrl: null,
  isProcured: false,
  procuredAt: null,
  isStaged: false,
  stagedAt: null,
  inventoryItemId: null,
  notes: null,
  sortOrder: 0,
  deletedAt: null,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  ...overrides
});

const createApp = async () => {
  let phaseRecord: PhaseRecord | null = null;
  let budgetCategoryRecord: BudgetCategoryRecord | null = null;
  let supplyRecord: SupplyRecord | null = null;

  const app = Fastify();

  app.decorate("prisma", {
    householdMember: {
      findUnique: async () => ({ householdId, userId, role: "owner" })
    },
    project: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const id = typeof where.id === "string" ? where.id : projectId;
        if (id === projectId) {
          return { id: projectId, householdId, name: "Test Project" };
        }
        return null;
      }
    },
    projectPhase: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (!phaseRecord) return null;
        const id = typeof where.id === "string" ? where.id : phaseId;
        if (id !== phaseRecord.id) return null;
        // Return with full include shape
        return {
          ...phaseRecord,
          tasks: [],
          checklistItems: [],
          supplies: [],
          expenses: []
        };
      },
      findMany: async () => {
        if (!phaseRecord) return [];
        return [{
          ...phaseRecord,
          tasks: [],
          checklistItems: [],
          supplies: [],
          expenses: []
        }];
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        phaseRecord = buildPhaseRecord({
          name: data.name as string,
          status: (data.status as string) ?? "pending",
          sortOrder: (data.sortOrder as number) ?? 0
        });
        return phaseRecord;
      },
      findUniqueOrThrow: async () => ({
        ...phaseRecord!,
        tasks: [],
        checklistItems: [],
        supplies: [],
        expenses: []
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        if (!phaseRecord) throw new Error("Phase not found");
        phaseRecord = { ...phaseRecord, ...data, updatedAt: new Date("2026-03-17T00:00:00.000Z") };
        return { ...phaseRecord, tasks: [], checklistItems: [], supplies: [], expenses: [] };
      },
      count: async () => (phaseRecord ? 1 : 0),
      aggregate: async () => ({ _max: { sortOrder: null } })
    },
    projectBudgetCategory: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (!budgetCategoryRecord) return null;
        const id = typeof where.id === "string" ? where.id : categoryId;
        if (id !== budgetCategoryRecord.id) return null;
        return { ...budgetCategoryRecord, expenses: [] };
      },
      findMany: async () => {
        if (!budgetCategoryRecord) return [];
        return [{ ...budgetCategoryRecord, expenses: [] }];
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        budgetCategoryRecord = buildBudgetCategoryRecord({
          name: data.name as string,
          budgetAmount: (data.budgetAmount as number | null) ?? null
        });
        return { ...budgetCategoryRecord, expenses: [] };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        if (!budgetCategoryRecord) throw new Error("Category not found");
        budgetCategoryRecord = { ...budgetCategoryRecord, ...data, updatedAt: new Date("2026-03-17T00:00:00.000Z") };
        return { ...budgetCategoryRecord, expenses: [] };
      },
      delete: async () => budgetCategoryRecord,
      aggregate: async () => ({ _max: { sortOrder: null } })
    },
    projectPhaseSupply: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (!supplyRecord) return null;
        const id = typeof where.id === "string" ? where.id : supplyId;
        if (id !== supplyRecord.id) return null;
        return { ...supplyRecord, inventoryItem: null, purchaseLines: [] };
      },
      findMany: async () => (supplyRecord ? [{ ...supplyRecord, inventoryItem: null, purchaseLines: [] }] : []),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        supplyRecord = buildSupplyRecord({
          name: data.name as string,
          quantityNeeded: (data.quantityNeeded as number) ?? 1,
          unit: (data.unit as string) ?? "each"
        });
        return supplyRecord;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        if (!supplyRecord) throw new Error("Supply not found");
        supplyRecord = { ...supplyRecord, ...data, updatedAt: new Date("2026-03-17T00:00:00.000Z") };
        return { ...supplyRecord, inventoryItem: null, purchaseLines: [] };
      },
      aggregate: async () => ({ _max: { sortOrder: null } })
    },
    projectTask: {
      findFirst: async () => null,
      findMany: async () => []
    },
    projectExpense: {
      findMany: async () => []
    },
    projectPhaseChecklistItem: {
      findFirst: async () => null,
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: "clkeeperchecklistitem0001",
        phaseId,
        title: data.title as string,
        isCompleted: false,
        completedAt: null,
        sortOrder: (data.sortOrder as number | null) ?? null,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-01T00:00:00.000Z")
      }),
      aggregate: async () => ({ _max: { sortOrder: null } })
    },
    $transaction: async <T>(callback: (tx: unknown) => Promise<T>) => {
      return callback({
        projectPhase: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            phaseRecord = buildPhaseRecord({
              name: data.name as string,
              status: (data.status as string) ?? "pending",
              sortOrder: (data.sortOrder as number) ?? 0
            });
            return phaseRecord;
          },
          findUniqueOrThrow: async () => ({
            ...phaseRecord!,
            tasks: [],
            checklistItems: [],
            supplies: [],
            expenses: []
          }),
          update: async ({ data }: { data: Record<string, unknown> }) => {
            if (!phaseRecord) throw new Error("Phase not found");
            phaseRecord = { ...phaseRecord, ...data };
            return { ...phaseRecord, tasks: [], checklistItems: [], supplies: [], expenses: [] };
          }
        },
        projectPhaseSupply: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            supplyRecord = buildSupplyRecord({
              name: data.name as string,
              quantityNeeded: (data.quantityNeeded as number) ?? 1,
              unit: (data.unit as string) ?? "each",
              isProcured: (data.isProcured as boolean) ?? false,
              isStaged: (data.isStaged as boolean) ?? false
            });
            return supplyRecord;
          },
          findUniqueOrThrow: async () => ({
            ...supplyRecord!,
            inventoryItem: null,
            purchaseLines: []
          }),
          update: async ({ data }: { data: Record<string, unknown> }) => {
            if (!supplyRecord) throw new Error("Supply not found");
            supplyRecord = { ...supplyRecord, ...data, updatedAt: new Date("2026-03-17T00:00:00.000Z") };
            return { ...supplyRecord, inventoryItem: null, purchaseLines: [] };
          },
          updateMany: async () => ({ count: 0 })
        },
        projectTask: {
          findMany: async () => [],
          updateMany: async () => ({ count: 0 })
        },
        projectTaskDependency: {
          deleteMany: async () => ({ count: 0 })
        },
        projectExpense: {
          updateMany: async () => ({ count: 0 })
        },
        entry: {
          deleteMany: async () => ({ count: 0 })
        }
      });
    }
  } as never);

  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = { userId, clerkUserId: null, source: "dev-bypass" };
  });

  await app.register(errorHandlerPlugin);
  await app.register(projectPhaseRoutes);

  return { app };
};

describe("project phase CRUD", () => {
  it("creates a phase and returns 201", async () => {
    const { app } = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/phases`,
        payload: { name: "Design", status: "pending" }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ name: "Design", status: "pending", projectId });
    } finally {
      await app.close();
    }
  });

  it("returns 400 when phase name is missing", async () => {
    const { app } = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/phases`,
        payload: { status: "pending" }
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("lists phases for a project", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/phases`,
        payload: { name: "Phase 1" }
      });

      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/projects/${projectId}/phases`
      });

      expect(response.statusCode).toBe(200);
      const items = response.json<unknown[]>();
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("updates a phase name", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/phases`,
        payload: { name: "Design" }
      });

      const updateResponse = await app.inject({
        method: "PATCH",
        url: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}`,
        payload: { name: "Updated Design" }
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json()).toMatchObject({ name: "Updated Design" });
    } finally {
      await app.close();
    }
  });

  it("soft-deletes a phase and returns 204", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/phases`,
        payload: { name: "Phase 1" }
      });

      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}`
      });

      expect(deleteResponse.statusCode).toBe(204);
    } finally {
      await app.close();
    }
  });

  it("returns 404 when deleting a non-existent phase", async () => {
    const { app } = await createApp();

    try {
      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/v1/households/${householdId}/projects/${projectId}/phases/clkeeperphase00000000099`
      });

      expect(deleteResponse.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

describe("budget category CRUD", () => {
  it("creates a budget category", async () => {
    const { app } = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/budget-categories`,
        payload: { name: "Materials", budgetAmount: 2000 }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ name: "Materials", budgetAmount: 2000 });
    } finally {
      await app.close();
    }
  });

  it("lists budget categories for a project", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/budget-categories`,
        payload: { name: "Labor" }
      });

      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/projects/${projectId}/budget-categories`
      });

      expect(response.statusCode).toBe(200);
      const items = response.json<unknown[]>();
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("updates a budget category name and amount", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/budget-categories`,
        payload: { name: "Materials" }
      });

      const updateResponse = await app.inject({
        method: "PATCH",
        url: `/v1/households/${householdId}/projects/${projectId}/budget-categories/${categoryId}`,
        payload: { name: "Tools & Materials", budgetAmount: 1500 }
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json()).toMatchObject({ name: "Tools & Materials", budgetAmount: 1500 });
    } finally {
      await app.close();
    }
  });

  it("deletes a budget category", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/budget-categories`,
        payload: { name: "Materials" }
      });

      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/v1/households/${householdId}/projects/${projectId}/budget-categories/${categoryId}`
      });

      expect(deleteResponse.statusCode).toBe(204);
    } finally {
      await app.close();
    }
  });

  it("returns 400 when budget category name is missing", async () => {
    const { app } = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/budget-categories`,
        payload: { budgetAmount: 500 }
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});

describe("phase supply CRUD", () => {
  it("creates a supply for a phase", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/phases`,
        payload: { name: "Framing" }
      });

      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/supplies`,
        payload: { name: "Lumber 2x4", quantityNeeded: 10, unit: "each", quantityOnHand: 0, isProcured: false, isStaged: false }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ name: "Lumber 2x4", quantityNeeded: 10 });
    } finally {
      await app.close();
    }
  });

  it("lists supplies for a phase", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/phases`,
        payload: { name: "Framing" }
      });
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/supplies`,
        payload: { name: "Nails", quantityNeeded: 500, unit: "each", quantityOnHand: 0, isProcured: false, isStaged: false }
      });

      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/supplies`
      });

      expect(response.statusCode).toBe(200);
      const items = response.json<unknown[]>();
      expect(Array.isArray(items)).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("updates a supply quantity and marks it procured", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/phases`,
        payload: { name: "Framing" }
      });
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/supplies`,
        payload: { name: "Lumber", quantityNeeded: 10, unit: "each", quantityOnHand: 0, isProcured: false, isStaged: false }
      });

      const updateResponse = await app.inject({
        method: "PATCH",
        url: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/supplies/${supplyId}`,
        payload: { name: "Lumber", isProcured: true, quantityOnHand: 10 }
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json()).toMatchObject({ isProcured: true, quantityOnHand: 10 });
    } finally {
      await app.close();
    }
  });

  it("soft-deletes a supply", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/phases`,
        payload: { name: "Framing" }
      });
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/supplies`,
        payload: { name: "Lumber", quantityNeeded: 10, unit: "each", quantityOnHand: 0, isProcured: false, isStaged: false }
      });

      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/supplies/${supplyId}`
      });

      expect(deleteResponse.statusCode).toBe(204);
    } finally {
      await app.close();
    }
  });
});

describe("phase checklist", () => {
  it("creates a checklist item for a phase", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/phases`,
        payload: { name: "Demo Phase" }
      });

      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/phases/${phaseId}/checklist`,
        payload: { title: "Review drawings" }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ title: "Review drawings", isCompleted: false });
    } finally {
      await app.close();
    }
  });
});
