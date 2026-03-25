import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, householdId, userId, fixedDate } from "./helpers.js";

// ─── Module mocks ─────────────────────────────────────────────────────────────
vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined),
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) })),
}));

vi.mock("../src/lib/asset-access.js", () => ({
  requireHouseholdMembership: vi.fn(async () => true),
  assertMembership: vi.fn(async () => undefined),
  assertOwner: vi.fn(async () => undefined),
  getAccessibleAsset: vi.fn(),
}));

vi.mock("../src/lib/soft-delete.js", () => ({
  softDeleteData: vi.fn(() => ({ deletedAt: new Date() })),
}));

import { noteTemplateRoutes } from "../src/routes/notes/templates.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const templateId = "clkeepertemplate00000001";

type TemplateRecord = {
  id: string;
  householdId: string;
  name: string;
  description: string | null;
  bodyTemplate: string;
  entryType: string;
  defaultTags: unknown[];
  defaultFlags: unknown[];
  isBuiltIn: boolean;
  sortOrder: number;
  createdById: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const buildTemplateRecord = (overrides: Partial<TemplateRecord> = {}): TemplateRecord => ({
  id: templateId,
  householdId,
  name: "Session Notes",
  description: "Template for session notes",
  bodyTemplate: "## What I worked on\n\n## Observations\n\n## Next steps",
  entryType: "note",
  defaultTags: [],
  defaultFlags: [],
  isBuiltIn: false,
  sortOrder: 0,
  createdById: userId,
  deletedAt: null,
  createdAt: fixedDate,
  updatedAt: fixedDate,
  ...overrides,
});

const buildPrisma = (template: TemplateRecord | null = buildTemplateRecord()) => ({
  noteTemplate: {
    findMany: vi.fn(async () => (template ? [template] : [])),
    findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      if (!template) return null;
      if (where.id && where.id !== template.id) return null;
      if (template.deletedAt) return null;
      return template;
    }),
    create: vi.fn(async () => template ?? buildTemplateRecord()),
    update: vi.fn(async ({ data }: { data: Partial<TemplateRecord> }) => ({
      ...(template ?? buildTemplateRecord()),
      ...data,
    })),
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── List templates ───────────────────────────────────────────────────────────
describe("GET /v1/households/:householdId/note-templates", () => {
  it("returns a list of templates", async () => {
    const app = await buildApp(noteTemplateRoutes, buildPrisma());
    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/note-templates`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<unknown[]>();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it("returns empty array when no templates exist", async () => {
    const app = await buildApp(noteTemplateRoutes, buildPrisma(null));
    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/note-templates`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<unknown[]>()).toHaveLength(0);
  });
});

// ─── Get single template ──────────────────────────────────────────────────────
describe("GET /v1/households/:householdId/note-templates/:templateId", () => {
  it("returns template by ID", async () => {
    const app = await buildApp(noteTemplateRoutes, buildPrisma());
    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/note-templates/${templateId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string; name: string }>();
    expect(body.id).toBe(templateId);
    expect(body.name).toBe("Session Notes");
  });

  it("returns 404 for missing template", async () => {
    const app = await buildApp(noteTemplateRoutes, buildPrisma(null));
    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/note-templates/${templateId}`,
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── Create template ──────────────────────────────────────────────────────────
describe("POST /v1/households/:householdId/note-templates", () => {
  it("creates a custom template and returns 201", async () => {
    const app = await buildApp(noteTemplateRoutes, buildPrisma());
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/note-templates`,
      payload: {
        name: "Session Notes",
        bodyTemplate: "## Notes\n",
        entryType: "note",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{ id: string; isBuiltIn: boolean }>();
    expect(body).toHaveProperty("id");
    expect(body.isBuiltIn).toBe(false);
  });

  it("rejects missing name", async () => {
    const app = await buildApp(noteTemplateRoutes, buildPrisma());
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/note-templates`,
      payload: { bodyTemplate: "## Notes\n", entryType: "note" },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ─── Update template ──────────────────────────────────────────────────────────
describe("PATCH /v1/households/:householdId/note-templates/:templateId", () => {
  it("updates a custom template", async () => {
    const app = await buildApp(noteTemplateRoutes, buildPrisma());
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/note-templates/${templateId}`,
      payload: { name: "Updated Name" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ name: string }>();
    expect(body.name).toBe("Updated Name");
  });

  it("returns 403 when updating a built-in template", async () => {
    const builtInTemplate = buildTemplateRecord({ isBuiltIn: true });
    const app = await buildApp(noteTemplateRoutes, buildPrisma(builtInTemplate));
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/note-templates/${templateId}`,
      payload: { name: "Attempt to override" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for missing template", async () => {
    const app = await buildApp(noteTemplateRoutes, buildPrisma(null));
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/households/${householdId}/note-templates/${templateId}`,
      payload: { name: "New name" },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── Delete template ──────────────────────────────────────────────────────────
describe("DELETE /v1/households/:householdId/note-templates/:templateId", () => {
  it("soft-deletes a custom template and returns 204", async () => {
    const app = await buildApp(noteTemplateRoutes, buildPrisma());
    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/note-templates/${templateId}`,
    });

    expect(res.statusCode).toBe(204);
  });

  it("returns 403 when deleting a built-in template", async () => {
    const builtInTemplate = buildTemplateRecord({ isBuiltIn: true });
    const app = await buildApp(noteTemplateRoutes, buildPrisma(builtInTemplate));
    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/note-templates/${templateId}`,
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for missing template", async () => {
    const app = await buildApp(noteTemplateRoutes, buildPrisma(null));
    const res = await app.inject({
      method: "DELETE",
      url: `/v1/households/${householdId}/note-templates/${templateId}`,
    });

    expect(res.statusCode).toBe(404);
  });
});
