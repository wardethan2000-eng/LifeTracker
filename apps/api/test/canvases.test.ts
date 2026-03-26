import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildApp, householdId, userId, fixedDate, fixedDateStr } from "./helpers.js";

// ─── Module mocks ─────────────────────────────────────────────────────────────
vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined),
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) })),
}));

vi.mock("../src/lib/asset-access.js", () => ({
  assertMembership: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/pdf-canvas.js", () => {
  const { PassThrough } = require("node:stream");
  return {
    generateCanvasPdf: vi.fn(() => {
      const stream = new PassThrough();
      // End the stream asynchronously so Fastify .pipe() works
      process.nextTick(() => {
        stream.write(Buffer.from("%PDF-1.4 fake"));
        stream.end();
      });
      return stream;
    }),
  };
});

import { ideaCanvasRoutes } from "../src/routes/canvases/index.js";

// ─── Fixture helpers ──────────────────────────────────────────────────────────
const canvasId = "clkeepercanvas000000001";
const nodeId = "clkeepernode00000000001";
const nodeId2 = "clkeepernode00000000002";
const edgeId = "clkeeperedge00000000001";

function buildCanvasRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: canvasId,
    householdId,
    name: "Living Room",
    entityType: null,
    entityId: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    physicalWidth: null,
    physicalHeight: null,
    physicalUnit: null,
    backgroundImageUrl: null,
    snapToGrid: true,
    gridSize: 20,
    canvasMode: "diagram",
    showDimensions: false,
    guides: [],
    createdById: userId,
    createdAt: fixedDate,
    updatedAt: fixedDate,
    deletedAt: null,
    ...overrides,
  };
}

function buildNodeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: nodeId,
    canvasId,
    entryId: null,
    label: "Start",
    body: null,
    x: 100,
    y: 200,
    x2: 0,
    y2: 0,
    width: 160,
    height: 80,
    color: null,
    strokeColor: null,
    fillColor: null,
    strokeWidth: 1,
    shape: "rectangle",
    objectType: "flowchart",
    rotation: 0,
    sortOrder: 0,
    imageUrl: null,
    maskJson: null,
    wallThickness: 6,
    wallAngle: null,
    wallHeight: null,
    physicalLength: null,
    parentNodeId: null,
    pointAx: null,
    pointAy: null,
    pointBx: null,
    pointBy: null,
    pointsJson: null,
    createdAt: fixedDate,
    updatedAt: fixedDate,
    ...overrides,
  };
}

function buildEdgeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: edgeId,
    canvasId,
    sourceNodeId: nodeId,
    targetNodeId: nodeId2,
    label: null,
    style: "solid",
    createdAt: fixedDate,
    updatedAt: fixedDate,
    ...overrides,
  };
}

function buildCanvasWithRelations(overrides: Record<string, unknown> = {}) {
  return {
    ...buildCanvasRecord(),
    nodes: [buildNodeRecord()],
    edges: [],
    ...overrides,
  };
}

// ─── Prisma mock builder ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mocks are intentionally untyped
type AnyMock = Record<string, any>;

function buildPrisma(overrides: Record<string, AnyMock> = {}): AnyMock {
  return {
    householdMember: {
      findUnique: vi.fn(async () => ({ householdId, userId, role: "owner" })),
    },
    ideaCanvas: {
      findMany: vi.fn(async () => [
        { ...buildCanvasRecord(), _count: { nodes: 3, edges: 1 } },
      ]),
      findFirst: vi.fn(async () => buildCanvasWithRelations()),
      create: vi.fn(async () => buildCanvasWithRelations()),
      update: vi.fn(async () => buildCanvasWithRelations()),
      ...overrides.ideaCanvas,
    },
    ideaCanvasNode: {
      create: vi.fn(async () => buildNodeRecord()),
      findFirst: vi.fn(async () => buildNodeRecord()),
      update: vi.fn(async () => buildNodeRecord({ label: "Updated" })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      delete: vi.fn(async () => buildNodeRecord()),
      ...overrides.ideaCanvasNode,
    },
    ideaCanvasEdge: {
      create: vi.fn(async () => buildEdgeRecord()),
      findFirst: vi.fn(async () => buildEdgeRecord()),
      update: vi.fn(async () => buildEdgeRecord({ label: "Yes" })),
      delete: vi.fn(async () => buildEdgeRecord()),
      ...overrides.ideaCanvasEdge,
    },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Canvas CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /v1/households/:householdId/canvases", () => {
  it("returns a list of canvas summaries", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/canvases`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toMatchObject({
      id: canvasId,
      name: "Living Room",
      nodeCount: 3,
      edgeCount: 1,
    });
    expect(prisma.ideaCanvas.findMany).toHaveBeenCalledTimes(1);
  });

  it("filters by entityType and entityId", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/canvases?entityType=asset&entityId=asset123`,
    });

    const call = prisma.ideaCanvas.findMany.mock.calls[0]! as Array<{ where: Record<string, unknown> }>;
    expect(call[0]!.where).toMatchObject({
      householdId,
      entityType: "asset",
      entityId: "asset123",
      deletedAt: null,
    });
  });

  it("returns geometry when include=geometry", async () => {
    const canvasWithGeometry = {
      ...buildCanvasRecord(),
      nodes: [{ id: nodeId, x: 10, y: 20, x2: 0, y2: 0, width: 160, height: 80, objectType: "flowchart", shape: "rectangle", color: null, strokeColor: null, fillColor: null, strokeWidth: 1, rotation: 0, sortOrder: 0, label: "Test", imageUrl: null, maskJson: null, pointsJson: null, pointAx: null, pointAy: null, pointBx: null, pointBy: null, wallThickness: 6, wallAngle: null }],
      edges: [{ id: edgeId, sourceNodeId: nodeId, targetNodeId: nodeId2, label: null, style: "solid" }],
    };
    const prisma = buildPrisma({
      ideaCanvas: {
        findMany: vi.fn(async () => [canvasWithGeometry]),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/canvases?include=geometry`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body[0]).toHaveProperty("nodes");
    expect(body[0]).toHaveProperty("edges");
    expect(body[0].nodes[0]).toHaveProperty("x", 10);
  });
});

describe("GET /v1/households/:householdId/canvases/:canvasId", () => {
  it("returns a full canvas with nodes and edges", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/canvases/${canvasId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      id: canvasId,
      name: "Living Room",
      canvasMode: "diagram",
    });
    expect(Array.isArray(body.nodes)).toBe(true);
    expect(Array.isArray(body.edges)).toBe(true);
    expect(body.createdAt).toBe(fixedDateStr);
  });

  it("returns 404 for non-existent canvas", async () => {
    const prisma = buildPrisma({
      ideaCanvas: {
        findFirst: vi.fn(async () => null),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/canvases/${canvasId}`,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ message: expect.stringContaining("not found") });
  });
});

describe("POST /v1/households/:householdId/canvases", () => {
  it("creates a canvas and returns 201", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/canvases`,
      payload: { name: "Kitchen Floor Plan" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("name");
    expect(prisma.ideaCanvas.create).toHaveBeenCalledTimes(1);
  });

  it("creates with optional entityType and canvasMode", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/canvases`,
      payload: { name: "My Plan", entityType: "asset", entityId: "asset1", canvasMode: "floorplan" },
    });

    const call = prisma.ideaCanvas.create.mock.calls[0]! as Array<{ data: Record<string, unknown> }>;
    expect(call[0]!.data).toMatchObject({
      name: "My Plan",
      entityType: "asset",
      entityId: "asset1",
      canvasMode: "floorplan",
    });
  });

  it("returns 400 for missing name", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/canvases`,
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /v1/households/:householdId/canvases/:canvasId", () => {
  it("updates canvas name", async () => {
    const updated = buildCanvasWithRelations({ name: "Garage" });
    const prisma = buildPrisma({
      ideaCanvas: {
        update: vi.fn(async () => updated),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/canvases/${canvasId}`,
      payload: { name: "Garage" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: "Garage" });
  });

  it("updates viewport properties", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/canvases/${canvasId}`,
      payload: { zoom: 1.5, panX: 100, panY: -50 },
    });

    const call = prisma.ideaCanvas.update.mock.calls[0]! as Array<{ data: Record<string, unknown> }>;
    expect(call[0]!.data).toMatchObject({ zoom: 1.5, panX: 100, panY: -50 });
  });

  it("returns 404 when canvas does not exist", async () => {
    const prisma = buildPrisma({
      ideaCanvas: {
        findFirst: vi.fn(async () => null),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/canvases/${canvasId}`,
      payload: { name: "X" },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /v1/households/:householdId/canvases/:canvasId", () => {
  it("soft-deletes and returns 204", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/canvases/${canvasId}`,
    });

    expect(res.statusCode).toBe(204);
    expect(prisma.ideaCanvas.update).toHaveBeenCalledTimes(1);
    const call = prisma.ideaCanvas.update.mock.calls[0]! as Array<{ data: Record<string, unknown> }>;
    expect(call[0]!.data).toHaveProperty("deletedAt");
  });

  it("returns 404 when canvas already deleted", async () => {
    const prisma = buildPrisma({
      ideaCanvas: {
        findFirst: vi.fn(async () => null),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/canvases/${canvasId}`,
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("PATCH /v1/households/:householdId/canvases/:canvasId/settings", () => {
  it("updates canvas settings", async () => {
    const updated = buildCanvasWithRelations({
      physicalWidth: 800,
      physicalHeight: 600,
      physicalUnit: "ft",
      snapToGrid: false,
      gridSize: 10,
    });
    const prisma = buildPrisma({
      ideaCanvas: {
        update: vi.fn(async () => updated),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/canvases/${canvasId}/settings`,
      payload: {
        physicalWidth: 800,
        physicalHeight: 600,
        physicalUnit: "ft",
        snapToGrid: false,
        gridSize: 10,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.ideaCanvas.update).toHaveBeenCalledTimes(1);
    const call = prisma.ideaCanvas.update.mock.calls[0]! as Array<{ data: Record<string, unknown> }>;
    expect(call[0]!.data).toMatchObject({
      physicalWidth: 800,
      physicalHeight: 600,
      physicalUnit: "ft",
    });
  });

  it("updates guides", async () => {
    const guide = { id: "guide-1", axis: "horizontal", position: 100 };
    const updated = buildCanvasWithRelations({ guides: [guide] });
    const prisma = buildPrisma({
      ideaCanvas: {
        update: vi.fn(async () => updated),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/canvases/${canvasId}/settings`,
      payload: { guides: [guide] },
    });

    expect(res.statusCode).toBe(200);
    const call = prisma.ideaCanvas.update.mock.calls[0]! as Array<{ data: Record<string, unknown> }>;
    expect(call[0]!.data).toHaveProperty("guides");
  });

  it("returns 404 for non-existent canvas", async () => {
    const prisma = buildPrisma({
      ideaCanvas: {
        findFirst: vi.fn(async () => null),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/canvases/${canvasId}/settings`,
      payload: { gridSize: 10 },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Canvas PDF Export
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /v1/households/:householdId/canvases/:canvasId/export/pdf", () => {
  it("returns 404 for non-existent canvas", async () => {
    const prisma = buildPrisma({
      ideaCanvas: {
        findFirst: vi.fn(async () => null),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/canvases/${canvasId}/export/pdf`,
    });

    expect(res.statusCode).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Node CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /v1/households/:householdId/canvases/:canvasId/nodes", () => {
  it("creates a node and returns 201", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/canvases/${canvasId}/nodes`,
      payload: { label: "Step 1", x: 50, y: 100 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({ id: nodeId, label: "Start" });
    expect(prisma.ideaCanvasNode.create).toHaveBeenCalledTimes(1);
  });

  it("creates a wall node with floorplan properties", async () => {
    const wallNode = buildNodeRecord({
      objectType: "wall",
      wallThickness: 12,
      wallAngle: 90,
      physicalLength: 300,
    });
    const prisma = buildPrisma({
      ideaCanvasNode: {
        create: vi.fn(async () => wallNode),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/canvases/${canvasId}/nodes`,
      payload: {
        label: "Wall",
        objectType: "wall",
        wallThickness: 12,
        wallAngle: 90,
        physicalLength: 300,
      },
    });

    expect(res.statusCode).toBe(201);
    const call = prisma.ideaCanvasNode.create.mock.calls[0]! as Array<{ data: Record<string, unknown> }>;
    expect(call[0]!.data).toMatchObject({
      label: "Wall",
      objectType: "wall",
      wallThickness: 12,
      wallAngle: 90,
      physicalLength: 300,
    });
  });

  it("returns 404 when canvas does not exist", async () => {
    const prisma = buildPrisma({
      ideaCanvas: {
        findFirst: vi.fn(async () => null),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/canvases/${canvasId}/nodes`,
      payload: { label: "Orphan" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("creates a node with defaults when payload is empty", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/canvases/${canvasId}/nodes`,
      payload: {},
    });

    expect(res.statusCode).toBe(201);
  });

  it("returns 400 for invalid width", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/canvases/${canvasId}/nodes`,
      payload: { width: -1 },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /v1/households/:householdId/canvases/:canvasId/nodes/:nodeId", () => {
  it("updates a node", async () => {
    const updatedNode = buildNodeRecord({ label: "Updated Label", x: 200 });
    const prisma = buildPrisma({
      ideaCanvasNode: {
        update: vi.fn(async () => updatedNode),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/canvases/${canvasId}/nodes/${nodeId}`,
      payload: { label: "Updated Label", x: 200 },
    });

    expect(res.statusCode).toBe(200);
    const call = prisma.ideaCanvasNode.update.mock.calls[0]! as Array<{ data: Record<string, unknown> }>;
    expect(call[0]!.data).toMatchObject({ label: "Updated Label", x: 200 });
  });

  it("updates shape and styling properties", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/canvases/${canvasId}/nodes/${nodeId}`,
      payload: {
        shape: "diamond",
        color: "#ff0000",
        strokeColor: "#000",
        fillColor: "#fff",
        strokeWidth: 2,
        rotation: 45,
      },
    });

    const call = prisma.ideaCanvasNode.update.mock.calls[0]! as Array<{ data: Record<string, unknown> }>;
    expect(call[0]!.data).toMatchObject({
      shape: "diamond",
      color: "#ff0000",
      strokeColor: "#000",
      fillColor: "#fff",
      strokeWidth: 2,
      rotation: 45,
    });
  });

  it("returns 404 for non-existent node", async () => {
    const prisma = buildPrisma({
      ideaCanvasNode: {
        findFirst: vi.fn(async () => null),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/canvases/${canvasId}/nodes/${nodeId}`,
      payload: { label: "X" },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /v1/households/:householdId/canvases/:canvasId/nodes/:nodeId", () => {
  it("deletes a node and returns 204", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/canvases/${canvasId}/nodes/${nodeId}`,
    });

    expect(res.statusCode).toBe(204);
    expect(prisma.ideaCanvasNode.delete).toHaveBeenCalledWith({ where: { id: nodeId } });
  });

  it("returns 404 for non-existent node", async () => {
    const prisma = buildPrisma({
      ideaCanvasNode: {
        findFirst: vi.fn(async () => null),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/canvases/${canvasId}/nodes/${nodeId}`,
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("PATCH /v1/households/:householdId/canvases/:canvasId/nodes/batch", () => {
  it("batch updates node positions and returns updated canvas", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/canvases/${canvasId}/nodes/batch`,
      payload: {
        nodes: [
          { id: nodeId, x: 300, y: 400 },
          { id: nodeId2, x: 500, y: 600, width: 200, height: 100 },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when canvas does not exist", async () => {
    const prisma = buildPrisma({
      ideaCanvas: {
        findFirst: vi.fn(async () => null),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/canvases/${canvasId}/nodes/batch`,
      payload: { nodes: [{ id: nodeId, x: 0, y: 0 }] },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Edge CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /v1/households/:householdId/canvases/:canvasId/edges", () => {
  it("creates an edge and returns 201", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/canvases/${canvasId}/edges`,
      payload: { sourceNodeId: nodeId, targetNodeId: nodeId2 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({
      id: edgeId,
      sourceNodeId: nodeId,
      targetNodeId: nodeId2,
      style: "solid",
    });
    expect(prisma.ideaCanvasEdge.create).toHaveBeenCalledTimes(1);
  });

  it("creates an edge with label and style", async () => {
    const styledEdge = buildEdgeRecord({ label: "Yes", style: "dashed" });
    const prisma = buildPrisma({
      ideaCanvasEdge: {
        create: vi.fn(async () => styledEdge),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/canvases/${canvasId}/edges`,
      payload: { sourceNodeId: nodeId, targetNodeId: nodeId2, label: "Yes", style: "dashed" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().label).toBe("Yes");
  });

  it("rejects self-loops", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/canvases/${canvasId}/edges`,
      payload: { sourceNodeId: nodeId, targetNodeId: nodeId },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("Self-loops");
  });

  it("rejects edges between non-diagram nodes", async () => {
    const wallNode = buildNodeRecord({ id: nodeId, objectType: "wall" });
    const prisma = buildPrisma({
      ideaCanvasNode: {
        findFirst: vi.fn(async () => wallNode),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/canvases/${canvasId}/edges`,
      payload: { sourceNodeId: nodeId, targetNodeId: nodeId2 },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("diagram nodes");
  });

  it("rejects edges when nodes don't belong to canvas", async () => {
    const prisma = buildPrisma({
      ideaCanvasNode: {
        findFirst: vi.fn(async () => null),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/canvases/${canvasId}/edges`,
      payload: { sourceNodeId: "nonexistent1", targetNodeId: "nonexistent2" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("same canvas");
  });

  it("returns 404 when canvas does not exist", async () => {
    const prisma = buildPrisma({
      ideaCanvas: {
        findFirst: vi.fn(async () => null),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/canvases/${canvasId}/edges`,
      payload: { sourceNodeId: nodeId, targetNodeId: nodeId2 },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("PATCH /v1/households/:householdId/canvases/:canvasId/edges/:edgeId", () => {
  it("updates an edge label", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/canvases/${canvasId}/edges/${edgeId}`,
      payload: { label: "No" },
    });

    expect(res.statusCode).toBe(200);
    const call = prisma.ideaCanvasEdge.update.mock.calls[0]! as Array<{ data: Record<string, unknown> }>;
    expect(call[0]!.data).toMatchObject({ label: "No" });
  });

  it("updates edge style", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/canvases/${canvasId}/edges/${edgeId}`,
      payload: { style: "dotted" },
    });

    const call = prisma.ideaCanvasEdge.update.mock.calls[0]! as Array<{ data: Record<string, unknown> }>;
    expect(call[0]!.data).toMatchObject({ style: "dotted" });
  });

  it("returns 404 for non-existent edge", async () => {
    const prisma = buildPrisma({
      ideaCanvasEdge: {
        findFirst: vi.fn(async () => null),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/canvases/${canvasId}/edges/${edgeId}`,
      payload: { label: "X" },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /v1/households/:householdId/canvases/:canvasId/edges/:edgeId", () => {
  it("deletes an edge and returns 204", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/canvases/${canvasId}/edges/${edgeId}`,
    });

    expect(res.statusCode).toBe(204);
    expect(prisma.ideaCanvasEdge.delete).toHaveBeenCalledWith({ where: { id: edgeId } });
  });

  it("returns 404 for non-existent edge", async () => {
    const prisma = buildPrisma({
      ideaCanvasEdge: {
        findFirst: vi.fn(async () => null),
      },
    });
    const app = await buildApp(ideaCanvasRoutes, prisma);

    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/canvases/${canvasId}/edges/${edgeId}`,
    });

    expect(res.statusCode).toBe(404);
  });
});
