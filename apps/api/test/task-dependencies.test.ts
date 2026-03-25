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

import { errorHandlerPlugin } from "../src/plugins/error-handler.js";
import { projectDependencyRoutes } from "../src/routes/projects/dependencies.js";

const householdId = "clkeeperhouse000000000001";
const projectId = "clkeeperproject0000000001";
const taskAId = "clkeepertaskaaaa000000001";
const taskBId = "clkeepertaskbbbb000000001";
const taskCId = "clkeepertaskcccc000000001";
const depId = "clkeeperdepaaa0000000001";
const userId = "clkeeperuser0000000000001";

type DependencyRecord = {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
  dependencyType: string;
  lagDays: number;
  createdAt: Date;
  updatedAt: Date;
};

const makeDep = (overrides: Partial<DependencyRecord> = {}): DependencyRecord => ({
  id: depId,
  predecessorTaskId: taskAId,
  successorTaskId: taskBId,
  dependencyType: "finish_to_start",
  lagDays: 0,
  createdAt: new Date("2026-03-25T00:00:00.000Z"),
  updatedAt: new Date("2026-03-25T00:00:00.000Z"),
  ...overrides
});

type TaskRecord = {
  id: string;
  projectId: string;
  deletedAt: Date | null;
  predecessorLinks: Array<{ predecessorTaskId: string; successorTaskId: string }>;
};

const createApp = () => {
  let dependencies: DependencyRecord[] = [];
  let tasks: TaskRecord[] = [
    { id: taskAId, projectId, deletedAt: null, predecessorLinks: [] },
    { id: taskBId, projectId, deletedAt: null, predecessorLinks: [] },
    { id: taskCId, projectId, deletedAt: null, predecessorLinks: [] }
  ];

  const app = Fastify();

  app.decorate("prisma", {
    householdMember: {
      findUnique: async () => ({ householdId, userId, role: "owner" })
    },
    project: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id === projectId && where.householdId === householdId) {
          return { id: projectId, householdId };
        }
        return null;
      }
    },
    projectTask: {
      findMany: async () => tasks
    },
    projectTaskDependency: {
      findMany: async () => dependencies,
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        const pair = where.predecessorTaskId_successorTaskId as { predecessorTaskId: string; successorTaskId: string } | undefined;
        if (pair) {
          return dependencies.find((d) => d.predecessorTaskId === pair.predecessorTaskId && d.successorTaskId === pair.successorTaskId) ?? null;
        }
        return null;
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (typeof where.id === "string") {
          return dependencies.find((d) => d.id === where.id) ?? null;
        }
        return null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const dep = makeDep({
          predecessorTaskId: data.predecessorTaskId as string,
          successorTaskId: data.successorTaskId as string,
          dependencyType: (data.dependencyType as string) ?? "finish_to_start",
          lagDays: (data.lagDays as number) ?? 0
        });
        dependencies.push(dep);
        // Update task's predecessorLinks for acyclicity checks on subsequent calls
        const successor = tasks.find((t) => t.id === dep.successorTaskId);
        if (successor) {
          successor.predecessorLinks.push({ predecessorTaskId: dep.predecessorTaskId, successorTaskId: dep.successorTaskId });
        }
        return dep;
      },
      update: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const dep = dependencies.find((d) => d.id === where.id);
        if (!dep) throw new Error("Not found");
        Object.assign(dep, data, { updatedAt: new Date("2026-03-25T12:00:00.000Z") });
        return dep;
      },
      delete: async ({ where }: { where: Record<string, unknown> }) => {
        const idx = dependencies.findIndex((d) => d.id === where.id);
        if (idx === -1) throw new Error("Not found");
        const [removed] = dependencies.splice(idx, 1);
        return removed;
      }
    }
  } as never);

  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = { userId, clerkUserId: null, source: "dev-bypass" };
  });

  return { app, getDependencies: () => dependencies, getTasks: () => tasks };
};

describe("GET /dependencies", () => {
  it("returns empty array when no dependencies exist", async () => {
    const { app } = createApp();
    await app.register(errorHandlerPlugin);
    await app.register(projectDependencyRoutes);

    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/projects/${projectId}/dependencies`,
      headers: { "x-dev-user-id": userId }
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

describe("POST /dependencies", () => {
  it("creates a finish_to_start dependency and returns 201", async () => {
    const { app } = createApp();
    await app.register(errorHandlerPlugin);
    await app.register(projectDependencyRoutes);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/projects/${projectId}/dependencies`,
      headers: { "x-dev-user-id": userId },
      payload: {
        predecessorTaskId: taskAId,
        successorTaskId: taskBId,
        dependencyType: "finish_to_start",
        lagDays: 0
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.predecessorTaskId).toBe(taskAId);
    expect(body.successorTaskId).toBe(taskBId);
    expect(body.dependencyType).toBe("finish_to_start");
    expect(body.lagDays).toBe(0);
    expect(body.id).toBeDefined();
  });

  it("rejects self-reference with 400", async () => {
    const { app } = createApp();
    await app.register(errorHandlerPlugin);
    await app.register(projectDependencyRoutes);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/projects/${projectId}/dependencies`,
      headers: { "x-dev-user-id": userId },
      payload: {
        predecessorTaskId: taskAId,
        successorTaskId: taskAId
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/cannot depend on itself/i);
  });

  it("rejects cross-project task references with 400", async () => {
    const { app } = createApp();
    await app.register(errorHandlerPlugin);
    await app.register(projectDependencyRoutes);

    const foreignTaskId = "clkeepertaskzzzz000000001";

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/projects/${projectId}/dependencies`,
      headers: { "x-dev-user-id": userId },
      payload: {
        predecessorTaskId: foreignTaskId,
        successorTaskId: taskBId
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/not found in this project/i);
  });

  it("rejects duplicate dependency with 409", async () => {
    const { app, getDependencies, getTasks } = createApp();
    // Pre-populate: A → B already exists
    getDependencies().push(makeDep({ predecessorTaskId: taskAId, successorTaskId: taskBId }));
    getTasks().find((t) => t.id === taskBId)!.predecessorLinks.push({ predecessorTaskId: taskAId, successorTaskId: taskBId });

    await app.register(errorHandlerPlugin);
    await app.register(projectDependencyRoutes);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/projects/${projectId}/dependencies`,
      headers: { "x-dev-user-id": userId },
      payload: {
        predecessorTaskId: taskAId,
        successorTaskId: taskBId
      }
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().message).toMatch(/already exists/i);
  });

  it("rejects circular dependency chain with 409", async () => {
    const { app, getDependencies, getTasks } = createApp();
    // Pre-populate: A → B, B → C
    getDependencies().push(makeDep({ id: "clkeeperdepaab0000000001", predecessorTaskId: taskAId, successorTaskId: taskBId }));
    getDependencies().push(makeDep({ id: "clkeeperdepabc0000000001", predecessorTaskId: taskBId, successorTaskId: taskCId }));
    getTasks().find((t) => t.id === taskBId)!.predecessorLinks.push({ predecessorTaskId: taskAId, successorTaskId: taskBId });
    getTasks().find((t) => t.id === taskCId)!.predecessorLinks.push({ predecessorTaskId: taskBId, successorTaskId: taskCId });

    await app.register(errorHandlerPlugin);
    await app.register(projectDependencyRoutes);

    // Attempt C → A (would create cycle A→B→C→A)
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/projects/${projectId}/dependencies`,
      headers: { "x-dev-user-id": userId },
      payload: {
        predecessorTaskId: taskCId,
        successorTaskId: taskAId
      }
    });

    expect(res.statusCode).toBe(409);
  });
});

describe("PATCH /dependencies/:dependencyId", () => {
  it("updates the dependency type and lag days", async () => {
    const { app, getDependencies } = createApp();
    getDependencies().push(makeDep());
    await app.register(errorHandlerPlugin);
    await app.register(projectDependencyRoutes);

    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/projects/${projectId}/dependencies/${depId}`,
      headers: { "x-dev-user-id": userId },
      payload: { dependencyType: "start_to_start", lagDays: 2 }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.dependencyType).toBe("start_to_start");
    expect(body.lagDays).toBe(2);
  });
});

describe("DELETE /dependencies/:dependencyId", () => {
  it("deletes the dependency and returns 204", async () => {
    const { app, getDependencies } = createApp();
    getDependencies().push(makeDep());
    await app.register(errorHandlerPlugin);
    await app.register(projectDependencyRoutes);

    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/projects/${projectId}/dependencies/${depId}`,
      headers: { "x-dev-user-id": userId }
    });

    expect(res.statusCode).toBe(204);
    expect(getDependencies()).toHaveLength(0);
  });

  it("returns 404 when dependency not found", async () => {
    const { app } = createApp();
    await app.register(errorHandlerPlugin);
    await app.register(projectDependencyRoutes);

    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/projects/${projectId}/dependencies/${depId}`,
      headers: { "x-dev-user-id": userId }
    });

    expect(res.statusCode).toBe(404);
  });
});
