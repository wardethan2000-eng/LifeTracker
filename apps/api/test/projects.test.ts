import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined),
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) }))
}));

vi.mock("../src/lib/search-index.js", () => ({
  syncProjectToSearchIndex: vi.fn(async () => undefined),
  syncLogToSearchIndex: vi.fn(async () => undefined),
  syncScheduleToSearchIndex: vi.fn(async () => undefined),
  removeSearchIndexEntry: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/queues.js", () => ({
  enqueueNotificationScan: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/domain-events.js", () => ({
  emitDomainEvent: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/maintenance-logs.js", () => ({
  syncScheduleCompletionFromLogs: vi.fn(async () => undefined),
  toMaintenanceLogResponse: vi.fn((log: unknown) => log)
}));

vi.mock("../src/lib/project-hierarchy.js", () => ({
  resolveProjectHierarchyInput: vi.fn(async () => ({ parentProjectId: null, depth: 0 })),
  syncProjectTreeDepths: vi.fn(async () => undefined),
  ProjectHierarchyValidationError: class ProjectHierarchyValidationError extends Error {}
}));

vi.mock("../src/lib/project-status.js", () => ({
  syncProjectDerivedStatuses: vi.fn(async () => undefined),
  getProjectCompletionSummary: vi.fn(async () => ({ taskCount: 0, completedTaskCount: 0, phaseCount: 0, completedPhaseCount: 0 })),
  buildProjectCompletionGuardrailMessage: vi.fn(() => ""),
  getPhaseCompletionSummary: vi.fn(async () => ({ taskCount: 0, completedTaskCount: 0 })),
  buildPhaseCompletionGuardrailMessage: vi.fn(() => "")
}));

import { errorHandlerPlugin } from "../src/plugins/error-handler.js";
import { projectRoutes } from "../src/routes/projects/index.js";

const householdId = "clkeeperhouse000000000001";
const projectId = "clkeeperproject0000000001";
const expenseId = "clkeeperexpense000000001";
const phaseId = "clkeeperphase00000000001";
const budgetCategoryId = "clkeeperbudgetcat00000001";
const userId = "clkeeperuser0000000000001";

type ProjectRecord = {
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
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ExpenseRecord = {
  id: string;
  projectId: string;
  phaseId: string | null;
  budgetCategoryId: string | null;
  taskId: string | null;
  serviceProviderId: string | null;
  description: string;
  amount: number;
  category: string | null;
  date: Date | null;
  notes: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const buildProjectRecord = (overrides: Partial<ProjectRecord> = {}): ProjectRecord => ({
  id: projectId,
  householdId,
  name: "Bathroom Renovation",
  description: null,
  status: "planning",
  startDate: null,
  targetEndDate: null,
  actualEndDate: null,
  budgetAmount: null,
  notes: null,
  parentProjectId: null,
  depth: 0,
  deletedAt: null,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  ...overrides
});

const buildExpenseRecord = (overrides: Partial<ExpenseRecord> = {}): ExpenseRecord => ({
  id: expenseId,
  projectId,
  phaseId: null,
  budgetCategoryId: null,
  taskId: null,
  serviceProviderId: null,
  description: "Tiles purchase",
  amount: 450,
  category: "materials",
  date: new Date("2026-03-15T00:00:00.000Z"),
  notes: null,
  deletedAt: null,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  ...overrides
});

const createApp = async (opts: { hasPhase?: boolean; hasBudgetCategory?: boolean } = {}) => {
  let projectRecord: ProjectRecord | null = null;
  let expenseRecord: ExpenseRecord | null = null;

  const app = Fastify();

  app.decorate("prisma", {
    householdMember: {
      findUnique: async () => ({ householdId, userId, role: "owner" })
    },
    project: {
      findFirst: async ({ where }: { where: Record<string, unknown>; include?: unknown }) => {
        if (!projectRecord) return null;
        if (typeof where.id === "string" && where.id !== projectRecord.id) return null;
        // Return with full include shape expected by the GET detail route
        return {
          ...projectRecord,
          assets: [],
          hobbyLinks: [],
          tasks: [],
          expenses: [],
          phases: [],
          budgetCategories: [],
          _count: { tasks: 0 }
        };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        projectRecord = buildProjectRecord({
          name: data.name as string,
          description: (data.description as string | null) ?? null,
          status: (data.status as string | undefined) ?? "planning",
          budgetAmount: (data.budgetAmount as number | null) ?? null
        });
        return projectRecord;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        if (!projectRecord) throw new Error("Project not found");
        projectRecord = { ...projectRecord, ...data, updatedAt: new Date("2026-03-17T00:00:00.000Z") };
        return projectRecord;
      },
      findMany: async () => [],
      count: async () => 0,
      groupBy: async () => []
    },
    projectExpense: {
      findMany: async () => (expenseRecord ? [expenseRecord] : []),
      findFirst: async () => expenseRecord,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        expenseRecord = buildExpenseRecord({
          description: data.description as string,
          amount: data.amount as number,
          phaseId: (data.phaseId as string | null) ?? null,
          budgetCategoryId: (data.budgetCategoryId as string | null) ?? null,
          category: (data.category as string | null) ?? null,
          taskId: (data.taskId as string | null) ?? null,
          notes: (data.notes as string | null) ?? null
        });
        return expenseRecord;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        if (!expenseRecord) throw new Error("Expense not found");
        expenseRecord = { ...expenseRecord, ...data, updatedAt: new Date("2026-03-17T00:00:00.000Z") };
        return expenseRecord;
      },
      count: async () => 0
    },
    projectPhase: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (!opts.hasPhase) return null;
        if (typeof where.id === "string" && where.id !== phaseId) return null;
        return { id: phaseId, projectId, name: "Demo Phase" };
      },
      findMany: async () => [],
      count: async () => 0
    },
    projectBudgetCategory: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (!opts.hasBudgetCategory) return null;
        if (typeof where.id === "string" && where.id !== budgetCategoryId) return null;
        return { id: budgetCategoryId, projectId, name: "Materials" };
      },
      count: async () => 0
    },
    projectTask: {
      findFirst: async () => null,
      findMany: async () => [],
      count: async ({ where }: { where: Record<string, unknown> }) => {
        if (typeof where.projectId === "string") return 0;
        return 0;
      }
    },
    projectInventoryItem: {
      findMany: async () => [],
      count: async () => 0
    },
    serviceProvider: {
      findFirst: async () => null
    },
    comment: { count: async () => 0 },
    projectAsset: { count: async () => 0 },
    $queryRaw: async () => [{ id: projectId, name: "Bathroom Renovation" }]
  } as never);

  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = { userId, clerkUserId: null, source: "dev-bypass" };
  });

  await app.register(errorHandlerPlugin);
  await app.register(projectRoutes);

  return { app, getProjectRecord: () => projectRecord, getExpenseRecord: () => expenseRecord };
};

describe("project CRUD", () => {
  it("creates a project and returns 201 with serialized response", async () => {
    const { app } = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects`,
        payload: { name: "Bathroom Renovation", status: "planning" }
      });

      expect(response.statusCode).toBe(201);
      const body = response.json<{ id: string; name: string; status: string; householdId: string }>();
      expect(body).toMatchObject({
        name: "Bathroom Renovation",
        status: "planning",
        householdId
      });
      expect(body.id).toBeTruthy();
    } finally {
      await app.close();
    }
  });

  it("returns 400 when name is missing", async () => {
    const { app } = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects`,
        payload: { status: "planning" }
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("creates then retrieves a project", async () => {
    const { app } = await createApp();

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects`,
        payload: { name: "Kitchen Remodel", budgetAmount: 5000 }
      });
      expect(createResponse.statusCode).toBe(201);

      const createdId = createResponse.json<{ id: string }>().id;

      const getResponse = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/projects/${createdId}`
      });
      expect(getResponse.statusCode).toBe(200);
      expect(getResponse.json()).toMatchObject({ id: createdId, name: "Kitchen Remodel" });
    } finally {
      await app.close();
    }
  });

  it("returns 404 for a non-existent project", async () => {
    const { app } = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/projects/clkeeperproject0000000099`
      });
      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("soft-deletes a project and returns 204", async () => {
    const { app, getProjectRecord } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects`,
        payload: { name: "Delete Me" }
      });

      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/v1/households/${householdId}/projects/${projectId}`
      });
      expect(deleteResponse.statusCode).toBe(204);
      expect(getProjectRecord()?.deletedAt).toBeTruthy();
    } finally {
      await app.close();
    }
  });

  it("restores a soft-deleted project", async () => {
    const { app } = await createApp();

    try {
      // Seed a deleted project by creating then deleting
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects`,
        payload: { name: "Restore Me" }
      });
      await app.inject({
        method: "DELETE",
        url: `/v1/households/${householdId}/projects/${projectId}`
      });

      const restoreResponse = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/restore`
      });
      expect(restoreResponse.statusCode).toBe(200);
      expect(restoreResponse.json<{ deletedAt: null }>().deletedAt).toBeNull();
    } finally {
      await app.close();
    }
  });
});

describe("project expense CRUD", () => {
  it("creates an expense and returns 201", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects`,
        payload: { name: "Reno" }
      });

      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/expenses`,
        payload: { description: "Tiles purchase", amount: 450 }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        description: "Tiles purchase",
        amount: 450,
        phaseId: null,
        budgetCategoryId: null
      });
    } finally {
      await app.close();
    }
  });

  it("creates an expense with a valid phaseId and stores it", async () => {
    const { app } = await createApp({ hasPhase: true });

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects`,
        payload: { name: "Reno" }
      });

      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/expenses`,
        payload: { description: "Phase materials", amount: 200, phaseId }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ phaseId, amount: 200 });
    } finally {
      await app.close();
    }
  });

  it("rejects an expense with an invalid phaseId", async () => {
    const { app } = await createApp({ hasPhase: false });

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects`,
        payload: { name: "Reno" }
      });

      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/expenses`,
        payload: { description: "Materials", amount: 100, phaseId: "clkeeperphase00000000099" }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<{ message: string }>().message).toContain("phase");
    } finally {
      await app.close();
    }
  });

  it("creates an expense with a valid budgetCategoryId and stores it", async () => {
    const { app } = await createApp({ hasBudgetCategory: true });

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects`,
        payload: { name: "Reno" }
      });

      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/expenses`,
        payload: { description: "Materials", amount: 300, budgetCategoryId }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ budgetCategoryId, amount: 300 });
    } finally {
      await app.close();
    }
  });

  it("rejects an expense with an invalid budgetCategoryId", async () => {
    const { app } = await createApp({ hasBudgetCategory: false });

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects`,
        payload: { name: "Reno" }
      });

      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/expenses`,
        payload: { description: "Materials", amount: 100, budgetCategoryId: "clkeeperbudgetcat00000099" }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<{ message: string }>().message).toContain("budget category");
    } finally {
      await app.close();
    }
  });

  it("lists expenses for a project", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects`,
        payload: { name: "Reno" }
      });
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/expenses`,
        payload: { description: "Tiles", amount: 450 }
      });

      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/projects/${projectId}/expenses`
      });

      expect(response.statusCode).toBe(200);
      const items = response.json<unknown[]>();
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("updates an expense description and amount", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects`,
        payload: { name: "Reno" }
      });
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/expenses`,
        payload: { description: "Original", amount: 100 }
      });

      const updateResponse = await app.inject({
        method: "PATCH",
        url: `/v1/households/${householdId}/projects/${projectId}/expenses/${expenseId}`,
        payload: { description: "Updated", amount: 200 }
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json()).toMatchObject({ description: "Updated", amount: 200 });
    } finally {
      await app.close();
    }
  });

  it("updates an expense to assign a phaseId", async () => {
    const { app } = await createApp({ hasPhase: true });

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects`,
        payload: { name: "Reno" }
      });
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/expenses`,
        payload: { description: "Materials", amount: 100 }
      });

      const updateResponse = await app.inject({
        method: "PATCH",
        url: `/v1/households/${householdId}/projects/${projectId}/expenses/${expenseId}`,
        payload: { phaseId }
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json()).toMatchObject({ phaseId });
    } finally {
      await app.close();
    }
  });

  it("rejects expense update with invalid phaseId", async () => {
    const { app } = await createApp({ hasPhase: false });

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects`,
        payload: { name: "Reno" }
      });
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/expenses`,
        payload: { description: "Original", amount: 100 }
      });

      const updateResponse = await app.inject({
        method: "PATCH",
        url: `/v1/households/${householdId}/projects/${projectId}/expenses/${expenseId}`,
        payload: { phaseId: "clkeeperphase00000000099" }
      });

      expect(updateResponse.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("soft-deletes an expense and returns 204", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects`,
        payload: { name: "Reno" }
      });
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/expenses`,
        payload: { description: "Tiles", amount: 450 }
      });

      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/v1/households/${householdId}/projects/${projectId}/expenses/${expenseId}`
      });

      expect(deleteResponse.statusCode).toBe(204);
    } finally {
      await app.close();
    }
  });

  it("returns 404 when deleting a non-existent expense", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects`,
        payload: { name: "Reno" }
      });

      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/v1/households/${householdId}/projects/${projectId}/expenses/clkeeperexpense000000099`
      });

      expect(deleteResponse.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

describe("delete impact", () => {
  it("returns counts for all linked entities", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects`,
        payload: { name: "Reno" }
      });

      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/projects/${projectId}/delete-impact`
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<Record<string, number>>();
      expect(typeof body.tasks).toBe("number");
      expect(typeof body.phases).toBe("number");
      expect(typeof body.expenses).toBe("number");
    } finally {
      await app.close();
    }
  });
});

describe("authorization", () => {
  it("returns 403 when user is not a household member", async () => {
    const app = Fastify();

    app.decorate("prisma", {
      householdMember: {
        findUnique: async () => null
      }
    } as never);

    app.decorateRequest("auth", undefined as never);
    app.addHook("preHandler", async (request) => {
      request.auth = { userId, clerkUserId: null, source: "dev-bypass" };
    });

    await app.register(projectRoutes);

    try {
      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/projects`
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });
});
