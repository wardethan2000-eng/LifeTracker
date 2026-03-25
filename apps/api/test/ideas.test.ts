import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, householdId, userId, householdMemberMock, fixedDate } from "./helpers.js";

// ─── Module mocks (must be hoisted before imports) ─────────────────────────
const activityMocks = vi.hoisted(() => ({
  log: vi.fn(async () => undefined),
}));

const searchMocks = vi.hoisted(() => ({
  syncIdeaToSearchIndex: vi.fn(async () => undefined),
  removeSearchIndexEntry: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined),
  createActivityLogger: vi.fn(() => ({ log: activityMocks.log })),
}));

vi.mock("../src/lib/search-index.js", () => ({
  syncIdeaToSearchIndex: searchMocks.syncIdeaToSearchIndex,
  removeSearchIndexEntry: searchMocks.removeSearchIndexEntry,
}));

vi.mock("../src/lib/asset-access.js", () => ({
  requireHouseholdMembership: vi.fn(async (_prisma: unknown, _hid: unknown, _uid: unknown, _reply: unknown) => true),
  assertMembership: vi.fn(async () => undefined),
  assertOwner: vi.fn(async () => undefined),
  getAccessibleAsset: vi.fn(async () => null),
}));

import { ideaRoutes } from "../src/routes/ideas/index.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const ideaId = "clkeeperidea0000000000001";

const buildIdeaRecord = (overrides: Record<string, unknown> = {}) => ({
  id: ideaId,
  householdId,
  createdById: userId,
  title: "Build a greenhouse",
  description: "Use reclaimed wood and polycarbonate panels",
  stage: "developing" as const,
  priority: "medium" as const,
  category: "home" as const,
  promotionTarget: null,
  notes: [],
  links: [],
  materials: [],
  steps: [],
  promotedAt: null,
  promotedToType: null,
  promotedToId: null,
  demotedFromType: null,
  demotedFromId: null,
  archivedAt: null,
  createdAt: fixedDate,
  updatedAt: fixedDate,
  ...overrides,
});

const buildPrisma = (ideaRecord: ReturnType<typeof buildIdeaRecord> | null = buildIdeaRecord()) => ({
  householdMember: householdMemberMock,
  idea: {
    findMany: vi.fn(async () => (ideaRecord ? [ideaRecord] : [])),
    findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      if (!ideaRecord) return null;
      if (where.id && where.id !== ideaRecord.id) return null;
      return ideaRecord;
    }),
    create: vi.fn(async () => ideaRecord ?? buildIdeaRecord()),
    update: vi.fn(async () => ideaRecord ?? buildIdeaRecord()),
    delete: vi.fn(async () => ideaRecord ?? buildIdeaRecord()),
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── List ideas ───────────────────────────────────────────────────────────────
describe("GET /v1/households/:householdId/ideas", () => {
  it("returns a paginated list of ideas", async () => {
    const app = await buildApp(ideaRoutes, buildPrisma());
    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/ideas`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ items: unknown[]; nextCursor: string | null }>();
    expect(body.items).toHaveLength(1);
    expect(body.nextCursor).toBeNull();
  });

  it("returns an empty list when no ideas exist", async () => {
    const app = await buildApp(ideaRoutes, buildPrisma(null));
    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/ideas`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ items: unknown[] }>().items).toHaveLength(0);
  });

  it("passes stage filter to the DB query", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaRoutes, prisma);
    await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/ideas?stage=spark`,
    });

    const callArgs = (prisma.idea.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArgs.where).toMatchObject({ stage: "spark" });
  });

  it("excludes archived ideas by default", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaRoutes, prisma);
    await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/ideas`,
    });

    const callArgs = (prisma.idea.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArgs.where).toMatchObject({ archivedAt: null });
  });

  it("includes archived ideas when includeArchived=true", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaRoutes, prisma);
    await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/ideas?includeArchived=true`,
    });

    const callArgs = (prisma.idea.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArgs.where.archivedAt).toBeUndefined();
  });
});

// ─── Get idea ─────────────────────────────────────────────────────────────────
describe("GET /v1/households/:householdId/ideas/:ideaId", () => {
  it("returns a single idea", async () => {
    const app = await buildApp(ideaRoutes, buildPrisma());
    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/ideas/${ideaId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string; title: string }>();
    expect(body.id).toBe(ideaId);
    expect(body.title).toBe("Build a greenhouse");
  });

  it("returns 404 when the idea does not exist", async () => {
    const app = await buildApp(ideaRoutes, buildPrisma(null));
    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/ideas/${ideaId}`,
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── Create idea ──────────────────────────────────────────────────────────────
describe("POST /v1/households/:householdId/ideas", () => {
  it("creates an idea and returns 201", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaRoutes, prisma);
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/ideas`,
      payload: { title: "Build a greenhouse" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json<{ title: string }>().title).toBe("Build a greenhouse");
    expect(prisma.idea.create).toHaveBeenCalledTimes(1);
  });

  it("calls the search index after creation", async () => {
    const app = await buildApp(ideaRoutes, buildPrisma());
    await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/ideas`,
      payload: { title: "Build a greenhouse" },
    });

    expect(searchMocks.syncIdeaToSearchIndex).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when title is missing", async () => {
    const app = await buildApp(ideaRoutes, buildPrisma());
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/ideas`,
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it("defaults stage to spark and priority to medium", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaRoutes, prisma);
    await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/ideas`,
      payload: { title: "New idea" },
    });

    const createArgs = (prisma.idea.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(createArgs.data).toMatchObject({ stage: "spark", priority: "medium" });
  });
});

// ─── Update idea ──────────────────────────────────────────────────────────────
describe("PATCH /v1/households/:householdId/ideas/:ideaId", () => {
  it("updates the idea title", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaRoutes, prisma);
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/ideas/${ideaId}`,
      payload: { title: "Updated title" },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.idea.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: "Updated title" }) })
    );
  });

  it("returns 404 when idea does not exist", async () => {
    const app = await buildApp(ideaRoutes, buildPrisma(null));
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/ideas/${ideaId}`,
      payload: { title: "New title" },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── Archive (soft-delete) idea ───────────────────────────────────────────────
describe("DELETE /v1/households/:householdId/ideas/:ideaId", () => {
  it("archives the idea (soft delete) and returns 204", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaRoutes, prisma);
    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/ideas/${ideaId}`,
    });

    expect(res.statusCode).toBe(204);
    expect(prisma.idea.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ archivedAt: expect.any(Date) }) })
    );
  });

  it("removes the idea from the search index", async () => {
    const app = await buildApp(ideaRoutes, buildPrisma());
    await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/ideas/${ideaId}`,
    });

    expect(searchMocks.removeSearchIndexEntry).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when idea does not exist", async () => {
    const app = await buildApp(ideaRoutes, buildPrisma(null));
    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/ideas/${ideaId}`,
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── Permanent delete ─────────────────────────────────────────────────────────
describe("DELETE /v1/households/:householdId/ideas/:ideaId/permanent", () => {
  it("permanently deletes the idea and returns 204", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaRoutes, prisma);
    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/ideas/${ideaId}/permanent`,
    });

    expect(res.statusCode).toBe(204);
    expect(prisma.idea.delete).toHaveBeenCalledWith({ where: { id: ideaId } });
  });
});

// ─── Stage transition ─────────────────────────────────────────────────────────
describe("PATCH /v1/households/:householdId/ideas/:ideaId/stage", () => {
  it("updates the stage", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaRoutes, prisma);
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/ideas/${ideaId}/stage`,
      payload: { stage: "developing" },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.idea.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stage: "developing" }) })
    );
  });

  it("rejects an invalid stage value", async () => {
    const app = await buildApp(ideaRoutes, buildPrisma());
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/ideas/${ideaId}/stage`,
      payload: { stage: "not_a_stage" },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ─── Idea notes (embedded JSON) ───────────────────────────────────────────────
describe("POST /v1/households/:householdId/ideas/:ideaId/notes", () => {
  it("appends a note to the idea", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaRoutes, prisma);
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/ideas/${ideaId}/notes`,
      payload: { text: "Check zoning regulations first" },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.idea.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notes: expect.arrayContaining([
            expect.objectContaining({ text: "Check zoning regulations first" }),
          ]),
        }),
      })
    );
  });

  it("returns 400 when text is missing", async () => {
    const app = await buildApp(ideaRoutes, buildPrisma());
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/ideas/${ideaId}/notes`,
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});

// ─── Idea links (embedded JSON) ───────────────────────────────────────────────
describe("POST /v1/households/:householdId/ideas/:ideaId/links", () => {
  it("appends a link to the idea", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(ideaRoutes, prisma);
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/ideas/${ideaId}/links`,
      payload: { url: "https://example.com/greenhouse", label: "Greenhouse guide" },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.idea.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          links: expect.arrayContaining([
            expect.objectContaining({ url: "https://example.com/greenhouse" }),
          ]),
        }),
      })
    );
  });

  it("returns 400 when url is missing", async () => {
    const app = await buildApp(ideaRoutes, buildPrisma());
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/ideas/${ideaId}/links`,
      payload: { label: "No URL" },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ─── Promote idea ─────────────────────────────────────────────────────────────
describe("POST /v1/households/:householdId/ideas/:ideaId/promote", () => {
  it("returns 409 when the idea has already been promoted", async () => {
    const promotedIdea = buildIdeaRecord({ promotedAt: fixedDate });
    const app = await buildApp(ideaRoutes, buildPrisma(promotedIdea));
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/ideas/${ideaId}/promote`,
      payload: { target: "project" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json<{ message: string }>().message).toContain("already been promoted");
  });

  it("returns 404 when the idea does not exist", async () => {
    const app = await buildApp(ideaRoutes, buildPrisma(null));
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/ideas/${ideaId}/promote`,
      payload: { target: "project" },
    });

    expect(res.statusCode).toBe(404);
  });
});
