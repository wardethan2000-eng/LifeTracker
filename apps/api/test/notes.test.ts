import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, householdId, userId, fixedDate } from "./helpers.js";

// ─── Module mocks ─────────────────────────────────────────────────────────────
const activityMocks = vi.hoisted(() => ({
  log: vi.fn(async () => undefined),
}));

const accessMocks = vi.hoisted(() => ({
  assertMembership: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined),
  createActivityLogger: vi.fn(() => ({ log: activityMocks.log })),
}));

vi.mock("../src/lib/asset-access.js", () => ({
  assertMembership: accessMocks.assertMembership,
  assertOwner: vi.fn(async () => undefined),
  requireHouseholdMembership: vi.fn(async () => true),
  getAccessibleAsset: vi.fn(),
}));

vi.mock("../src/lib/soft-delete.js", () => ({
  softDeleteData: vi.fn(() => ({ deletedAt: new Date() })),
}));

import { noteFolderRoutes } from "../src/routes/notes/index.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const folderId = "clkeeperfolder000000000001";
const parentFolderId = "clkeeperfolder000000000002";

const buildFolderRecord = (overrides: Record<string, unknown> = {}) => ({
  id: folderId,
  householdId,
  parentFolderId: null,
  name: "Project Notes",
  color: null,
  icon: null,
  sortOrder: 0,
  createdById: userId,
  deletedAt: null,
  createdAt: fixedDate,
  updatedAt: fixedDate,
  _count: { entries: 0, children: 0 },
  ...overrides,
});

const buildPrisma = (
  folder: ReturnType<typeof buildFolderRecord> | null = buildFolderRecord()
) => ({
  noteFolder: {
    findMany: vi.fn(async () => (folder ? [folder] : [])),
    findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      if (!folder) return null;
      if (where.id && where.id !== folder.id) return null;
      return folder;
    }),
    findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      if (!folder) return null;
      if (where.id && where.id !== folder.id) return null;
      return folder;
    }),
    create: vi.fn(async () => folder ?? buildFolderRecord()),
    update: vi.fn(async () => folder ?? buildFolderRecord()),
    updateMany: vi.fn(async () => ({ count: 0 })),
  },
  entry: {
    updateMany: vi.fn(async () => ({ count: 0 })),
  },
  $transaction: vi.fn(async (ops: unknown[]) => {
    // Execute each prisma call in the array
    if (Array.isArray(ops)) {
      return Promise.all(ops);
    }
    return ops;
  }),
});

beforeEach(() => {
  vi.clearAllMocks();
  accessMocks.assertMembership.mockResolvedValue(undefined);
});

// ─── List note folders ────────────────────────────────────────────────────────
describe("GET /v1/households/:householdId/note-folders", () => {
  it("returns a flat list of folders", async () => {
    const app = await buildApp(noteFolderRoutes, buildPrisma());
    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/note-folders`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<unknown[]>();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it("returns an empty array when no folders exist", async () => {
    const app = await buildApp(noteFolderRoutes, buildPrisma(null));
    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/note-folders`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<unknown[]>()).toHaveLength(0);
  });

  it("returns 403 when caller has no membership", async () => {
    accessMocks.assertMembership.mockRejectedValue(Object.assign(new Error("FORBIDDEN"), { statusCode: 403 }));
    const app = await buildApp(noteFolderRoutes, buildPrisma());
    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/note-folders`,
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns ISO dates in the response", async () => {
    const app = await buildApp(noteFolderRoutes, buildPrisma());
    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/note-folders`,
    });

    const body = res.json<Array<{ createdAt: string; updatedAt: string }>>();
    expect(body[0].createdAt).toBe(fixedDate.toISOString());
    expect(body[0].updatedAt).toBe(fixedDate.toISOString());
  });
});

// ─── Create note folder ───────────────────────────────────────────────────────
describe("POST /v1/households/:householdId/note-folders", () => {
  it("creates a folder and returns 201", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(noteFolderRoutes, prisma);
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/note-folders`,
      payload: { name: "Project Notes" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{ name: string; householdId: string }>();
    expect(body.name).toBe("Project Notes");
    expect(body.householdId).toBe(householdId);
    expect(prisma.noteFolder.create).toHaveBeenCalledTimes(1);
  });

  it("logs an activity after creation", async () => {
    const app = await buildApp(noteFolderRoutes, buildPrisma());
    await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/note-folders`,
      payload: { name: "Project Notes" },
    });

    expect(activityMocks.log).toHaveBeenCalledWith(
      "note_folder",
      expect.any(String),
      "note_folder_created",
      householdId,
      expect.any(Object)
    );
  });

  it("returns 400 when name is missing", async () => {
    const app = await buildApp(noteFolderRoutes, buildPrisma());
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/note-folders`,
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when the specified parent folder does not exist", async () => {
    const prisma = buildPrisma();
    // findFirst returns null for the parent folder check
    (prisma.noteFolder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = await buildApp(noteFolderRoutes, prisma);
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/note-folders`,
      payload: { name: "Child Folder", parentFolderId },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── Update note folder ───────────────────────────────────────────────────────
describe("PATCH /v1/households/:householdId/note-folders/:folderId", () => {
  it("updates the folder name", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(noteFolderRoutes, prisma);
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/note-folders/${folderId}`,
      payload: { name: "Renamed Folder" },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.noteFolder.update).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when the folder does not exist", async () => {
    const app = await buildApp(noteFolderRoutes, buildPrisma(null));
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/note-folders/${folderId}`,
      payload: { name: "Renamed" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 400 when folder is set as its own parent", async () => {
    const app = await buildApp(noteFolderRoutes, buildPrisma());
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/note-folders/${folderId}`,
      payload: { parentFolderId: folderId },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json<{ message: string }>().message).toContain("own parent");
  });
});

// ─── Delete note folder ───────────────────────────────────────────────────────
describe("DELETE /v1/households/:householdId/note-folders/:folderId", () => {
  it("soft-deletes the folder and orphans its children", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(noteFolderRoutes, prisma);
    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/note-folders/${folderId}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ success: boolean }>().success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when the folder does not exist", async () => {
    const app = await buildApp(noteFolderRoutes, buildPrisma(null));
    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/note-folders/${folderId}`,
    });

    expect(res.statusCode).toBe(404);
  });

  it("logs an activity after deletion", async () => {
    const app = await buildApp(noteFolderRoutes, buildPrisma());
    await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/note-folders/${folderId}`,
    });

    expect(activityMocks.log).toHaveBeenCalledWith(
      "note_folder",
      folderId,
      "note_folder_deleted",
      householdId,
      expect.any(Object)
    );
  });
});
