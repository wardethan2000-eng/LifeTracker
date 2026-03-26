import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildApp, householdId, userId, fixedDate } from "./helpers.js";

// ─── Module mocks ─────────────────────────────────────────────────────────────
vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined),
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) })),
}));

vi.mock("../src/lib/asset-access.js", () => ({
  requireHouseholdMembership: vi.fn(async () => true),
}));

import { canvasObjectRoutes } from "../src/routes/canvas-objects/index.js";

// ─── Fixture helpers ──────────────────────────────────────────────────────────
const objectId = "clkeepercanvobj00000001";

function buildObjectRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: objectId,
    householdId,
    name: "Blue Sofa",
    category: "furniture",
    imageSource: "preset" as const,
    presetKey: "furniture/sofa-blue",
    attachmentId: null,
    maskData: null,
    deletedAt: null,
    createdAt: fixedDate,
    updatedAt: fixedDate,
    ...overrides,
  };
}

// ─── Prisma mock builder ──────────────────────────────────────────────────────
function defaultPrisma() {
  return {
    householdMember: {
      findUnique: vi.fn(async () => ({ householdId, userId, role: "owner" })),
    },
    canvasObject: {
      findMany: vi.fn(async () => [buildObjectRecord()]),
      findFirst: vi.fn(async () => buildObjectRecord()),
      create: vi.fn(async () => buildObjectRecord()),
      update: vi.fn(async () => buildObjectRecord()),
    },
  };
}

function buildPrisma(overrides: Partial<ReturnType<typeof defaultPrisma>> = {}) {
  return { ...defaultPrisma(), ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Canvas Object List
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /v1/households/:householdId/canvas-objects", () => {
  it("returns all canvas objects", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(canvasObjectRoutes, prisma);

    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/canvas-objects`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toMatchObject({
      id: objectId,
      name: "Blue Sofa",
      category: "furniture",
    });
  });

  it("filters by category", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(canvasObjectRoutes, prisma);

    await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/canvas-objects?category=appliance`,
    });

    const call = prisma.canvasObject.findMany.mock.calls[0]! as Array<{ where: Record<string, unknown> }>;
    expect(call[0]!.where).toMatchObject({ category: "appliance" });
  });

  it("omits soft-deleted objects", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(canvasObjectRoutes, prisma);

    await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/canvas-objects`,
    });

    const call = prisma.canvasObject.findMany.mock.calls[0]! as Array<{ where: Record<string, unknown> }>;
    expect(call[0]!.where).toMatchObject({ deletedAt: null });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Canvas Object Get
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /v1/households/:householdId/canvas-objects/:objectId", () => {
  it("returns a single canvas object", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(canvasObjectRoutes, prisma);

    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/canvas-objects/${objectId}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: objectId,
      name: "Blue Sofa",
      imageSource: "preset",
      presetKey: "furniture/sofa-blue",
    });
  });

  it("returns 404 for non-existent object", async () => {
    const prisma = buildPrisma({
      canvasObject: {
        ...defaultPrisma().canvasObject,
        findFirst: vi.fn(async () => null as any),
      },
    });
    const app = await buildApp(canvasObjectRoutes, prisma);

    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/canvas-objects/${objectId}`,
    });

    expect(res.statusCode).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Canvas Object Create
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /v1/households/:householdId/canvas-objects", () => {
  it("creates a preset canvas object and returns 201", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(canvasObjectRoutes, prisma);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/canvas-objects`,
      payload: {
        name: "Blue Sofa",
        category: "furniture",
        imageSource: "preset",
        presetKey: "furniture/sofa-blue",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.canvasObject.create).toHaveBeenCalledTimes(1);
    const call = prisma.canvasObject.create.mock.calls[0]! as Array<{ data: Record<string, unknown> }>;
    expect(call[0]!.data).toMatchObject({
      name: "Blue Sofa",
      category: "furniture",
      imageSource: "preset",
      presetKey: "furniture/sofa-blue",
    });
  });

  it("creates an uploaded canvas object with mask data", async () => {
    const maskStr = JSON.stringify({ type: "crop", x: 0, y: 0, w: 100, h: 100 });
    const objWithMask = buildObjectRecord({
      imageSource: "uploaded",
      presetKey: null,
      attachmentId: "att-001",
      maskData: maskStr,
    });
    const prisma = buildPrisma({
      canvasObject: {
        ...defaultPrisma().canvasObject,
        create: vi.fn(async () => objWithMask),
      },
    });
    const app = await buildApp(canvasObjectRoutes, prisma);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/canvas-objects`,
      payload: {
        name: "Custom Image",
        category: "custom",
        imageSource: "uploaded",
        attachmentId: "att-001",
        maskData: maskStr,
      },
    });

    expect(res.statusCode).toBe(201);
  });

  it("returns 400 for missing required fields", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(canvasObjectRoutes, prisma);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/canvas-objects`,
      payload: { name: "Missing fields" },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Canvas Object Update
// ═══════════════════════════════════════════════════════════════════════════════

describe("PATCH /v1/households/:householdId/canvas-objects/:objectId", () => {
  it("updates object name", async () => {
    const updated = buildObjectRecord({ name: "Red Sofa" });
    const prisma = buildPrisma({
      canvasObject: {
        ...defaultPrisma().canvasObject,
        update: vi.fn(async () => updated),
      },
    });
    const app = await buildApp(canvasObjectRoutes, prisma);

    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/canvas-objects/${objectId}`,
      payload: { name: "Red Sofa" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Red Sofa");
  });

  it("updates category", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(canvasObjectRoutes, prisma);

    await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/canvas-objects/${objectId}`,
      payload: { category: "appliance" },
    });

    const call = prisma.canvasObject.update.mock.calls[0]! as Array<{ data: Record<string, unknown> }>;
    expect(call[0]!.data).toMatchObject({ category: "appliance" });
  });

  it("returns 404 when object does not exist", async () => {
    const prisma = buildPrisma({
      canvasObject: {
        ...defaultPrisma().canvasObject,
        findFirst: vi.fn(async () => null as any),
      },
    });
    const app = await buildApp(canvasObjectRoutes, prisma);

    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/canvas-objects/${objectId}`,
      payload: { name: "X" },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Canvas Object Delete
// ═══════════════════════════════════════════════════════════════════════════════

describe("DELETE /v1/households/:householdId/canvas-objects/:objectId", () => {
  it("soft-deletes and returns 204", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(canvasObjectRoutes, prisma);

    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/canvas-objects/${objectId}`,
    });

    expect(res.statusCode).toBe(204);
    expect(prisma.canvasObject.update).toHaveBeenCalledTimes(1);
    const call = prisma.canvasObject.update.mock.calls[0]! as Array<{ data: Record<string, unknown> }>;
    expect(call[0]!.data).toHaveProperty("deletedAt");
  });

  it("returns 404 when object does not exist", async () => {
    const prisma = buildPrisma({
      canvasObject: {
        ...defaultPrisma().canvasObject,
        findFirst: vi.fn(async () => null as any),
      },
    });
    const app = await buildApp(canvasObjectRoutes, prisma);

    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/canvas-objects/${objectId}`,
    });

    expect(res.statusCode).toBe(404);
  });
});
