import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildApp, householdId, userId, fixedDate } from "./helpers.js";

// ─── Module mocks ─────────────────────────────────────────────────────────────
vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined),
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) })),
  logAndEmit: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/asset-access.js", () => ({
  requireHouseholdMembership: vi.fn(async () => true),
  assertMembership: vi.fn(async () => undefined),
  assertOwner: vi.fn(async () => undefined),
  getAccessibleAsset: vi.fn(),
}));

vi.mock("../src/lib/search-index.js", () => ({
  syncEntryToSearchIndex: vi.fn(async () => undefined),
  removeSearchIndexEntry: vi.fn(async () => undefined),
  syncToSearchIndex: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/domain-events.js", () => ({
  emitDomainEvent: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/sanitize-html.js", () => ({
  sanitizeRichTextBody: vi.fn((s: string) => s),
}));

vi.mock("../src/lib/entries.js", () => ({
  validateEntryTarget: vi.fn(async (_prisma: unknown, _householdId: string, entityType: string, entityId: string) => ({
    status: "ok",
    context: {
      entityType,
      entityId,
      label: "Test Hobby",
      parentEntityType: null,
      parentEntityId: null,
      parentLabel: null,
    },
  })),
  createEntryEntityKey: vi.fn((entityType: string, entityId: string) => `${entityType}:${entityId}`),
  resolveEntryEntityContexts: vi.fn(async (_prisma: unknown, _householdId: string, targets: Array<{ entityType: string; entityId: string }>) => {
    const map = new Map<string, { entityType: string; entityId: string; label: string; parentEntityType: null; parentEntityId: null; parentLabel: null }>();
    for (const t of targets) {
      map.set(`${t.entityType}:${t.entityId}`, {
        entityType: t.entityType,
        entityId: t.entityId,
        label: "Test Entity",
        parentEntityType: null,
        parentEntityId: null,
        parentLabel: null,
      });
    }
    return map;
  }),
}));

import { entryRoutes } from "../src/routes/entries/index.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const entryId = "clkeeperentry00000000001";
const hobbyId = "clkeeperhobbysrc000000001";
const reminderDate = new Date("2026-04-01T09:00:00.000Z");

type EntryRecord = {
  id: string;
  householdId: string;
  createdById: string;
  title: string | null;
  body: string;
  bodyFormat: string;
  entryDate: Date;
  entityType: string;
  entityId: string;
  entryType: string;
  measurements: unknown[];
  tags: unknown[];
  attachmentUrl: string | null;
  attachmentName: string | null;
  sourceType: string | null;
  sourceId: string | null;
  folderId: string | null;
  reminderAt: Date | null;
  reminderRepeatDays: number | null;
  reminderUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
  flags: Array<{ flag: string }>;
  createdBy: { id: string; displayName: string };
};

const buildEntryRecord = (overrides: Partial<EntryRecord> = {}): EntryRecord => ({
  id: entryId,
  householdId,
  createdById: userId,
  title: "Weekly check-in",
  body: "Practiced scales for 30 minutes.",
  bodyFormat: "plain_text",
  entryDate: fixedDate,
  entityType: "hobby",
  entityId: hobbyId,
  entryType: "note",
  measurements: [],
  tags: [],
  attachmentUrl: null,
  attachmentName: null,
  sourceType: null,
  sourceId: null,
  folderId: null,
  reminderAt: null,
  reminderRepeatDays: null,
  reminderUntil: null,
  createdAt: fixedDate,
  updatedAt: fixedDate,
  flags: [],
  createdBy: { id: userId, displayName: "Test User" },
  ...overrides,
});

const buildPrisma = (record: EntryRecord | null = buildEntryRecord()) => {
  let current = record;

  return {
    $queryRaw: vi.fn(async () =>
      current ? [{ id: current.id, pinnedRank: 0, entryDate: current.entryDate, createdAt: current.createdAt, sortTitle: "" }] : []
    ),
    entry: {
      findMany: vi.fn(async () => (current ? [current] : [])),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (!current) return null;
        if (where.id && where.id !== current.id) return null;
        return current;
      }),
      findUniqueOrThrow: vi.fn(async () => {
        if (!current) throw new Error("Not found");
        return current;
      }),
      create: vi.fn(async () => {
        current = buildEntryRecord();
        return current;
      }),
      update: vi.fn(async ({ data }: { data: Partial<EntryRecord> }) => {
        if (current) current = { ...current, ...data };
        return current ?? buildEntryRecord();
      }),
      delete: vi.fn(async () => current ?? buildEntryRecord()),
    },
    entryFlagEntry: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      if (typeof fn === "function") {
        return fn({
          entry: {
            update: vi.fn(async () => current ?? buildEntryRecord()),
            findUniqueOrThrow: vi.fn(async () => current ?? buildEntryRecord()),
          },
          entryFlagEntry: {
            deleteMany: vi.fn(async () => ({ count: 0 })),
            createMany: vi.fn(async () => ({ count: 0 })),
          },
        });
      }
      return Promise.all(fn as Promise<unknown>[]);
    }),
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── List entries ─────────────────────────────────────────────────────────────
describe("GET /v1/households/:householdId/entries", () => {
  it("returns a paginated list of entries", async () => {
    const app = await buildApp(entryRoutes, buildPrisma());
    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/entries?entityType=hobby&entityId=${hobbyId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ items: unknown[]; nextCursor: unknown }>();
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
  });
});

// ─── Get single entry ─────────────────────────────────────────────────────────
describe("GET /v1/households/:householdId/entries/:entryId", () => {
  it("returns entry with reminder fields", async () => {
    const record = buildEntryRecord({ reminderAt: reminderDate, reminderRepeatDays: 7 });
    const app = await buildApp(entryRoutes, buildPrisma(record));
    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/entries/${entryId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ reminderAt: string; reminderRepeatDays: number }>();
    expect(body.reminderAt).toBe(reminderDate.toISOString());
    expect(body.reminderRepeatDays).toBe(7);
  });

  it("returns 404 for missing entry", async () => {
    const app = await buildApp(entryRoutes, buildPrisma(null));
    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/entries/${entryId}`,
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── Create entry ─────────────────────────────────────────────────────────────
describe("POST /v1/households/:householdId/entries", () => {
  it("creates entry and returns 201", async () => {
    const prisma = buildPrisma(null);
    const app = await buildApp(entryRoutes, prisma);
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/entries`,
      payload: {
        title: "New note",
        body: "Some content",
        bodyFormat: "plain_text",
        entryDate: fixedDate.toISOString(),
        entityType: "hobby",
        entityId: hobbyId,
        entryType: "note",
        tags: [],
        flags: [],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{ title: string }>();
    expect(body).toHaveProperty("id");
  });

  it("persists reminderAt and reminderRepeatDays on create", async () => {
    const prisma = buildPrisma(null);
    const app = await buildApp(entryRoutes, prisma);
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/entries`,
      payload: {
        title: "Reminder note",
        body: "Remember to do this thing",
        bodyFormat: "plain_text",
        entryDate: fixedDate.toISOString(),
        entityType: "hobby",
        entityId: hobbyId,
        entryType: "note",
        tags: [],
        flags: [],
        reminderAt: reminderDate.toISOString(),
        reminderRepeatDays: 7,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.entry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reminderAt: reminderDate,
          reminderRepeatDays: 7,
        }),
      })
    );
  });

  it("rejects entry without required body field", async () => {
    const app = await buildApp(entryRoutes, buildPrisma(null));
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/entries`,
      payload: {
        entityType: "hobby",
        entityId: hobbyId,
        entryDate: fixedDate.toISOString(),
        // body intentionally missing
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ─── Update entry ─────────────────────────────────────────────────────────────
describe("PATCH /v1/households/:householdId/entries/:entryId", () => {
  it("updates reminder fields", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(entryRoutes, prisma);
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/entries/${entryId}`,
      payload: {
        reminderAt: reminderDate.toISOString(),
        reminderRepeatDays: 14,
        reminderUntil: new Date("2026-07-01T00:00:00.000Z").toISOString(),
      },
    });

    expect(res.statusCode).toBe(200);
  });

  it("clears reminder with null", async () => {
    const record = buildEntryRecord({ reminderAt: reminderDate, reminderRepeatDays: 7 });
    const prisma = buildPrisma(record);
    const app = await buildApp(entryRoutes, prisma);
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/entries/${entryId}`,
      payload: { reminderAt: null },
    });

    expect(res.statusCode).toBe(200);
  });

  it("returns 404 for missing entry", async () => {
    const app = await buildApp(entryRoutes, buildPrisma(null));
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/entries/${entryId}`,
      payload: { title: "Updated" },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── Delete entry ─────────────────────────────────────────────────────────────
describe("DELETE /v1/households/:householdId/entries/:entryId", () => {
  it("returns 204 on success", async () => {
    const app = await buildApp(entryRoutes, buildPrisma());
    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/entries/${entryId}`,
    });

    expect(res.statusCode).toBe(204);
  });

  it("returns 404 if entry not found", async () => {
    const app = await buildApp(entryRoutes, buildPrisma(null));
    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/entries/${entryId}`,
    });

    expect(res.statusCode).toBe(404);
  });
});
