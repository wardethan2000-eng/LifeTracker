import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined),
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) }))
}));

vi.mock("../src/lib/search-index.js", () => ({
  syncAssetFamilyToSearchIndex: vi.fn(async () => undefined),
  removeSearchIndexEntry: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/asset-tags.js", () => ({
  buildAssetScanUrl: vi.fn((assetTag: string) => `https://example.test/scan/${assetTag}`),
  ensureAssetTag: vi.fn(async () => "LK-ASSETTEST01")
}));

import { assetRoutes } from "../src/routes/assets/index.js";
import { errorHandlerPlugin } from "../src/plugins/error-handler.js";

type AssetRecord = {
  id: string;
  householdId: string;
  createdById: string;
  ownerId: string | null;
  parentAssetId: string | null;
  assetTag: string | null;
  name: string;
  category: "vehicle" | "home" | "marine" | "aircraft" | "yard" | "workshop" | "appliance" | "hvac" | "technology" | "other";
  visibility: "shared" | "personal";
  description: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: Date | null;
  purchaseDetails: null;
  warrantyDetails: null;
  locationDetails: null;
  insuranceDetails: null;
  dispositionDetails: null;
  conditionScore: number | null;
  conditionHistory: unknown[];
  assetTypeKey: string | null;
  assetTypeLabel: string | null;
  assetTypeDescription: string | null;
  assetTypeSource: "manual" | "library" | "custom" | "inline";
  assetTypeVersion: number;
  fieldDefinitions: unknown[];
  customFields: Record<string, unknown>;
  isArchived: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const householdId = "clkeeperhouse000000000001";
const userId = "clkeeperuser0000000000001";
const assetId = "clkeeperasset0000000000001";

const buildAssetRecord = (overrides: Partial<AssetRecord> = {}): AssetRecord => ({
  id: assetId,
  householdId,
  createdById: userId,
  ownerId: userId,
  parentAssetId: null,
  assetTag: "LK-ASSETTEST01",
  name: "Primary Vehicle",
  category: "vehicle",
  visibility: "shared",
  description: null,
  manufacturer: null,
  model: null,
  serialNumber: null,
  purchaseDate: null,
  purchaseDetails: null,
  warrantyDetails: null,
  locationDetails: null,
  insuranceDetails: null,
  dispositionDetails: null,
  conditionScore: null,
  conditionHistory: [],
  assetTypeKey: null,
  assetTypeLabel: null,
  assetTypeDescription: null,
  assetTypeSource: "manual",
  assetTypeVersion: 1,
  fieldDefinitions: [],
  customFields: {},
  isArchived: false,
  deletedAt: null,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  ...overrides
});

type PrismaWhere = Record<string, unknown>;

const createApp = async (initial?: AssetRecord) => {
  let assetRecord: AssetRecord | null = initial ?? buildAssetRecord();

  const assetFindFirst = vi.fn(async ({ where, include }: { where: PrismaWhere; include?: unknown }) => {
    if (!assetRecord) return null;
    const idFilter = where.id;
    if (typeof idFilter === "string" && assetRecord.id !== idFilter) return null;
    const tagFilter = where.assetTag;
    if (typeof tagFilter === "string" && assetRecord.assetTag !== tagFilter) return null;
    if (include) return { ...assetRecord, parentAsset: null, childAssets: [] };
    return assetRecord;
  });

  const assetUpdate = vi.fn(async ({ where, data }: { where: { id: string }; data: PrismaWhere }) => {
    if (!assetRecord || assetRecord.id !== where.id) throw new Error("Not found");
    assetRecord = { ...assetRecord, ...data } as AssetRecord;
    return assetRecord;
  });

  const assetUpdateMany = vi.fn(async () => ({ count: 1 }));

  const assetDelete = vi.fn(async ({ where }: { where: { id: string } }) => {
    if (!assetRecord || assetRecord.id !== where.id) throw new Error("Not found");
    const r = assetRecord;
    assetRecord = null;
    return r;
  });

  const householdMemberFindUnique = vi.fn(async () => ({ householdId, userId, role: "owner" }));

  const txAssetUpdateMany = vi.fn(async () => ({ count: 1 }));

  const app = Fastify();

  app.decorate("prisma", {
    householdMember: {
      findUnique: householdMemberFindUnique
    },
    asset: {
      findFirst: assetFindFirst,
      findMany: vi.fn(async () => (assetRecord ? [assetRecord] : [])),
      count: vi.fn(async () => (assetRecord ? 1 : 0)),
      create: vi.fn(async ({ data }: { data: PrismaWhere }) => {
        assetRecord = buildAssetRecord({ name: data.name as string });
        return assetRecord;
      }),
      update: assetUpdate,
      updateMany: assetUpdateMany,
      delete: assetDelete
    },
    maintenanceSchedule: { count: vi.fn(async () => 2) },
    maintenanceLog: { count: vi.fn(async () => 3) },
    entry: { count: vi.fn(async () => 0) },
    comment: { count: vi.fn(async () => 1) },
    assetTransfer: { count: vi.fn(async () => 1) },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ asset: { updateMany: txAssetUpdateMany } })
    )
  } as never);

  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = { userId, clerkUserId: null, source: "dev-bypass" };
  });

  await app.register(errorHandlerPlugin);
  await app.register(assetRoutes);

  return {
    app,
    mocks: {
      householdMemberFindUnique,
      assetFindFirst,
      assetUpdate,
      assetUpdateMany,
      assetDelete,
      txAssetUpdateMany
    }
  };
};

// ── GET /v1/assets ───────────────────────────────────────────────────────────

describe("GET /v1/assets", () => {
  it("returns the asset list for authentic household members", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: `/v1/assets?householdId=${householdId}`
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as unknown[];
      expect(Array.isArray(body)).toBe(true);
      expect(body[0]).toMatchObject({ id: assetId, name: "Primary Vehicle" });
    } finally {
      await app.close();
    }
  });

  it("returns 403 for a user who is not a household member", async () => {
    const { app, mocks } = await createApp();
    mocks.householdMemberFindUnique.mockResolvedValueOnce(null);
    try {
      const res = await app.inject({
        method: "GET",
        url: `/v1/assets?householdId=${householdId}`
      });
      expect(res.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it("filters by category when the query param is provided", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: `/v1/assets?householdId=${householdId}&category=vehicle`
      });
      expect(res.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});

// ── GET /v1/assets/:assetId ──────────────────────────────────────────────────

describe("GET /v1/assets/:assetId", () => {
  it("returns the asset with parentAsset and childAssets", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({ method: "GET", url: `/v1/assets/${assetId}` });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: assetId, name: "Primary Vehicle" });
    } finally {
      await app.close();
    }
  });

  it("returns 404 when the asset does not exist", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: "/v1/assets/clkeeperassetmissing0000001"
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

// ── POST /v1/assets/:assetId/archive ────────────────────────────────────────

describe("POST /v1/assets/:assetId/archive", () => {
  it("archives the asset and detaches any child assets", async () => {
    const { app, mocks } = await createApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: `/v1/assets/${assetId}/archive`
      });
      expect(res.statusCode).toBe(200);
      expect(mocks.assetUpdateMany).toHaveBeenCalledWith({
        where: { parentAssetId: assetId },
        data: { parentAssetId: null }
      });
      expect(mocks.assetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isArchived: true } })
      );
    } finally {
      await app.close();
    }
  });

  it("returns 404 for an unknown asset", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/assets/clkeeperassetmissing0000001/archive"
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

// ── POST /v1/assets/:assetId/unarchive ──────────────────────────────────────

describe("POST /v1/assets/:assetId/unarchive", () => {
  it("clears isArchived on the asset", async () => {
    const { app, mocks } = await createApp(buildAssetRecord({ isArchived: true }));
    try {
      const res = await app.inject({
        method: "POST",
        url: `/v1/assets/${assetId}/unarchive`
      });
      expect(res.statusCode).toBe(200);
      expect(mocks.assetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isArchived: false } })
      );
    } finally {
      await app.close();
    }
  });
});

// ── DELETE /v1/assets/:assetId (soft delete) ────────────────────────────────

describe("DELETE /v1/assets/:assetId", () => {
  it("soft-deletes the asset by setting deletedAt", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "DELETE",
        url: `/v1/assets/${assetId}`
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as Record<string, unknown>;
      expect(body.deletedAt).toBeTruthy();
    } finally {
      await app.close();
    }
  });

  it("returns 404 for an unknown asset", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "DELETE",
        url: "/v1/assets/clkeeperassetmissing0000001"
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

// ── POST /v1/assets/:assetId/restore ────────────────────────────────────────

describe("POST /v1/assets/:assetId/restore", () => {
  it("clears deletedAt on a trashed asset", async () => {
    const { app, mocks } = await createApp(
      buildAssetRecord({ deletedAt: new Date("2026-04-01T00:00:00.000Z") })
    );
    try {
      const res = await app.inject({
        method: "POST",
        url: `/v1/assets/${assetId}/restore`
      });
      expect(res.statusCode).toBe(200);
      expect(mocks.assetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { deletedAt: null } })
      );
    } finally {
      await app.close();
    }
  });
});

// ── POST /v1/assets/:assetId/condition ──────────────────────────────────────

describe("POST /v1/assets/:assetId/condition", () => {
  it("records a condition score and updates conditionScore", async () => {
    const { app, mocks } = await createApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: `/v1/assets/${assetId}/condition`,
        payload: { score: 8 }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ conditionScore: 8 });
      expect(mocks.assetUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ conditionScore: 8 })
        })
      );
    } finally {
      await app.close();
    }
  });

  it("appends to conditionHistory with the provided notes", async () => {
    const { app, mocks } = await createApp();
    try {
      await app.inject({
        method: "POST",
        url: `/v1/assets/${assetId}/condition`,
        payload: { score: 6, notes: "Dent on door panel" }
      });
      const [[{ data }]] = mocks.assetUpdate.mock.calls as [{ data: Record<string, unknown> }][];
      const history = data.conditionHistory as Array<{ score: number; notes?: string }>;
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ score: 6, notes: "Dent on door panel" });
    } finally {
      await app.close();
    }
  });

  it("returns 404 for an unknown asset", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/assets/clkeeperassetmissing0000001/condition",
        payload: { score: 7 }
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

// ── GET /v1/assets/:assetId/children ────────────────────────────────────────

describe("GET /v1/assets/:assetId/children", () => {
  it("returns an array of child assets", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: `/v1/assets/${assetId}/children`
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    } finally {
      await app.close();
    }
  });
});

// ── GET /v1/assets/:assetId/delete-impact ───────────────────────────────────

describe("GET /v1/assets/:assetId/delete-impact", () => {
  it("returns correct impact counts across all entity types", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: `/v1/assets/${assetId}/delete-impact`
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        schedules: 2,
        logs: 3,
        entries: 0,
        comments: 1,
        transfers: 1
      });
    } finally {
      await app.close();
    }
  });
});

// ── DELETE /v1/assets/:assetId/purge ────────────────────────────────────────

describe("DELETE /v1/assets/:assetId/purge", () => {
  it("returns 400 when the asset has not been soft-deleted first", async () => {
    const { app } = await createApp(buildAssetRecord({ deletedAt: null }));
    try {
      const res = await app.inject({
        method: "DELETE",
        url: `/v1/assets/${assetId}/purge`
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toMatch(/Trash/);
    } finally {
      await app.close();
    }
  });

  it("hard-deletes an asset that has been moved to Trash", async () => {
    const { app, mocks } = await createApp(
      buildAssetRecord({ deletedAt: new Date("2026-04-01T00:00:00.000Z") })
    );
    try {
      const res = await app.inject({
        method: "DELETE",
        url: `/v1/assets/${assetId}/purge`
      });
      expect(res.statusCode).toBe(204);
      expect(mocks.assetDelete).toHaveBeenCalledWith({ where: { id: assetId } });
    } finally {
      await app.close();
    }
  });
});

// ── POST /v1/assets/bulk/archive ─────────────────────────────────────────────

describe("POST /v1/assets/bulk/archive", () => {
  it("bulk-archives all accessible assets when applyToAll is true", async () => {
    const { app, mocks } = await createApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/assets/bulk/archive",
        payload: { householdId, applyToAll: true }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ succeeded: 1 });
      expect(mocks.txAssetUpdateMany).toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("bulk-archives a specific list of asset IDs", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/assets/bulk/archive",
        payload: { householdId, assetIds: [assetId] }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ succeeded: 1, failed: [] });
    } finally {
      await app.close();
    }
  });

  it("returns 400 when neither applyToAll nor assetIds is provided", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/assets/bulk/archive",
        payload: { householdId }
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("returns 403 for a non-member user", async () => {
    const { app, mocks } = await createApp();
    mocks.householdMemberFindUnique.mockResolvedValueOnce(null);
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/assets/bulk/archive",
        payload: { householdId, applyToAll: true }
      });
      expect(res.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });
});

// ── POST /v1/assets/bulk/category ────────────────────────────────────────────

describe("POST /v1/assets/bulk/category", () => {
  it("reassigns category for all accessible assets when applyToAll is true", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/assets/bulk/category",
        payload: { householdId, applyToAll: true, category: "home" }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ succeeded: 1 });
    } finally {
      await app.close();
    }
  });

  it("reassigns category for a specific list of asset IDs", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/assets/bulk/category",
        payload: { householdId, assetIds: [assetId], category: "workshop" }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ succeeded: 1, failed: [] });
    } finally {
      await app.close();
    }
  });
});

// ── PATCH /v1/assets/:assetId (parent validation) ────────────────────────────

describe("PATCH /v1/assets/:assetId parent validation", () => {
  it("returns 400 when an asset attempts to set itself as its own parent", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "PATCH",
        url: `/v1/assets/${assetId}`,
        payload: { parentAssetId: assetId }
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toMatch(/own parent/i);
    } finally {
      await app.close();
    }
  });

  it("returns 400 when the referenced parent asset does not exist", async () => {
    const { app } = await createApp();
    try {
      const res = await app.inject({
        method: "PATCH",
        url: `/v1/assets/${assetId}`,
        payload: { parentAssetId: "clkeeperassetmissing0000001" }
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
