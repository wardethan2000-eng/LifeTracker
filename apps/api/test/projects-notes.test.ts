import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined),
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) }))
}));

vi.mock("../src/lib/search-index.js", () => ({
  syncEntryToSearchIndex: vi.fn(async () => undefined),
  removeSearchIndexEntry: vi.fn(async () => undefined)
}));

import { errorHandlerPlugin } from "../src/plugins/error-handler.js";
import { projectNoteRoutes } from "../src/routes/projects/notes.js";

const householdId = "clkeeperhouse000000000001";
const projectId = "clkeeperproject0000000001";
const noteId = "clkeepernote000000000001";
const userId = "clkeeperuser0000000000001";
const phaseId = "clkeeperphase00000000001";

type EntryRecord = {
  id: string;
  householdId: string;
  createdById: string;
  title: string;
  body: string | null;
  entryDate: Date;
  entityType: string;
  entityId: string;
  entryType: string;
  tags: unknown;
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdAt: Date;
  updatedAt: Date;
  flags: Array<{ id: string; entryId: string; flag: string }>;
  createdBy: { id: string; displayName: string };
};

const buildEntryRecord = (overrides: Partial<EntryRecord> = {}): EntryRecord => ({
  id: noteId,
  householdId,
  createdById: userId,
  title: "Initial observations",
  body: "Wall needs patching before tiling.",
  entryDate: new Date("2026-03-01T00:00:00.000Z"),
  entityType: "project",
  entityId: projectId,
  entryType: "project_note",
  tags: [],
  attachmentUrl: null,
  attachmentName: null,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  flags: [],
  createdBy: { id: userId, displayName: "Test User" },
  ...overrides
});

const createApp = async () => {
  let entryRecord: EntryRecord | null = null;

  const app = Fastify();

  app.decorate("prisma", {
    householdMember: {
      findUnique: async () => ({ householdId, userId, role: "owner" })
    },
    project: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (typeof where.id === "string" && where.id !== projectId) return null;
        return { id: projectId, householdId, name: "Bathroom Renovation" };
      }
    },
    projectPhase: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (typeof where.id === "string" && where.id === phaseId) {
          return { id: phaseId, projectId, name: "Demo Phase" };
        }
        return null;
      },
      findMany: async () => []
    },
    entry: {
      findMany: async () => (entryRecord ? [entryRecord] : []),
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (!entryRecord) return null;
        if (typeof where.id === "string" && where.id !== entryRecord.id) return null;
        return entryRecord;
      },
      findUniqueOrThrow: async () => {
        if (!entryRecord) throw new Error("Entry not found");
        return entryRecord;
      },
      create: async ({ data }: { data: Record<string, unknown>; include: unknown }) => {
        entryRecord = buildEntryRecord({
          title: data.title as string,
          body: (data.body as string | null) ?? null,
          entityType: (data.entityType as string) ?? "project",
          entityId: (data.entityId as string) ?? projectId,
          tags: data.tags ?? []
        });
        return entryRecord;
      },
      update: async ({ data }: { data: Record<string, unknown>; include: unknown }) => {
        if (!entryRecord) throw new Error("Entry not found");
        entryRecord = {
          ...entryRecord,
          title: (data.title as string | undefined) ?? entryRecord.title,
          body: (data.body as string | null | undefined) ?? entryRecord.body,
          updatedAt: new Date("2026-03-17T00:00:00.000Z")
        };
        return entryRecord;
      },
      delete: async () => {
        const deleted = entryRecord;
        entryRecord = null;
        return deleted;
      }
    },
    entryFlagEntry: {
      create: async () => ({ id: "clkeeperflag000000000001", entryId: noteId, flag: "pinned" }),
      delete: async () => undefined
    }
  } as never);

  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = { userId, clerkUserId: null, source: "dev-bypass" };
  });

  await app.register(errorHandlerPlugin);
  await app.register(projectNoteRoutes);

  return { app };
};

describe("project note CRUD", () => {
  it("creates a note and returns 201", async () => {
    const { app } = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/notes`,
        payload: { title: "Initial observations", body: "Wall needs patching." }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        title: "Initial observations",
        projectId
      });
    } finally {
      await app.close();
    }
  });

  it("returns 400 when note title is missing", async () => {
    const { app } = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/notes`,
        payload: { body: "Body only, no title." }
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("creates a note scoped to a phase", async () => {
    const { app } = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/notes`,
        payload: { title: "Phase note", body: "Phase-specific observation.", phaseId }
      });

      expect(response.statusCode).toBe(201);
      // The entity that backs the note is the phase when phaseId is provided
      expect(response.json()).toMatchObject({ projectId });
    } finally {
      await app.close();
    }
  });

  it("returns 400 when phaseId does not exist in this project", async () => {
    const { app } = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/notes`,
        payload: { title: "Bad phase note", phaseId: "clkeeperphase00000000099" }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<{ message: string }>().message).toContain("Phase");
    } finally {
      await app.close();
    }
  });

  it("lists notes for a project", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/notes`,
        payload: { title: "First note" }
      });

      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/projects/${projectId}/notes`
      });

      expect(response.statusCode).toBe(200);
      const items = response.json<unknown[]>();
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("fetches a single note by ID", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/notes`,
        payload: { title: "Detail note" }
      });

      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/projects/${projectId}/notes/${noteId}`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ id: noteId, title: "Detail note" });
    } finally {
      await app.close();
    }
  });

  it("returns 404 fetching a note that does not exist", async () => {
    const { app } = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/projects/${projectId}/notes/clkeepernote000000000099`
      });

      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("updates a note title and body", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/notes`,
        payload: { title: "Original title" }
      });

      const updateResponse = await app.inject({
        method: "PATCH",
        url: `/v1/households/${householdId}/projects/${projectId}/notes/${noteId}`,
        payload: { title: "Updated title", body: "Updated body content." }
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json()).toMatchObject({ title: "Updated title" });
    } finally {
      await app.close();
    }
  });

  it("deletes a note and returns 204", async () => {
    const { app } = await createApp();

    try {
      await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/projects/${projectId}/notes`,
        payload: { title: "Delete me" }
      });

      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/v1/households/${householdId}/projects/${projectId}/notes/${noteId}`
      });

      expect(deleteResponse.statusCode).toBe(204);
    } finally {
      await app.close();
    }
  });

  it("returns 404 deleting a note that does not exist", async () => {
    const { app } = await createApp();

    try {
      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/v1/households/${householdId}/projects/${projectId}/notes/clkeepernote000000000099`
      });

      expect(deleteResponse.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

describe("project note authorization", () => {
  it("returns 403 when user is not a household member", async () => {
    const app = Fastify();

    app.decorate("prisma", {
      householdMember: { findUnique: async () => null }
    } as never);

    app.decorateRequest("auth", undefined as never);
    app.addHook("preHandler", async (request) => {
      request.auth = { userId, clerkUserId: null, source: "dev-bypass" };
    });

    await app.register(projectNoteRoutes);

    try {
      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/projects/${projectId}/notes`
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });
});
