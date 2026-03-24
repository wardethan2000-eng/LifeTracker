import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined),
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) }))
}));

vi.mock("../src/lib/search-index.js", () => ({
  syncAssetFamilyToSearchIndex: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/asset-tags.js", () => ({
  buildAssetScanUrl: vi.fn((assetTag: string) => `https://example.test/scan/${assetTag}`),
  ensureAssetTag: vi.fn(async () => "LK-ASSETTEST01")
}));

import { assetRoutes } from "../src/routes/assets/index.js";

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

const buildAssetRecord = (overrides: Partial<AssetRecord> = {}): AssetRecord => ({
  id: "clkeeperasset0000000000001",
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

const createApp = async () => {
  let assetRecord: AssetRecord | null = null;
  const app = Fastify();

  app.decorate("prisma", {
    householdMember: {
      findUnique: async () => ({ householdId, userId, role: "owner" })
    },
    asset: {
      findFirst: async ({ where, include }: { where: Record<string, unknown>; include?: Record<string, unknown> }) => {
        if (typeof where.id === "string") {
          if (!assetRecord || assetRecord.id !== where.id) {
            return null;
          }

          if (include) {
            return {
              ...assetRecord,
              parentAsset: null,
              childAssets: []
            };
          }

          return assetRecord;
        }

        return null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        assetRecord = buildAssetRecord({
          name: data.name as string,
          category: data.category as AssetRecord["category"],
          visibility: data.visibility as AssetRecord["visibility"],
          description: (data.description as string | undefined) ?? null,
          manufacturer: (data.manufacturer as string | undefined) ?? null,
          model: (data.model as string | undefined) ?? null,
          serialNumber: (data.serialNumber as string | undefined) ?? null,
          purchaseDate: (data.purchaseDate as Date | undefined) ?? null,
          parentAssetId: (data.parentAssetId as string | undefined) ?? null,
          assetTypeKey: (data.assetTypeKey as string | undefined) ?? null,
          assetTypeLabel: (data.assetTypeLabel as string | undefined) ?? null,
          assetTypeDescription: (data.assetTypeDescription as string | undefined) ?? null,
          assetTypeSource: data.assetTypeSource as AssetRecord["assetTypeSource"],
          assetTypeVersion: data.assetTypeVersion as number,
          fieldDefinitions: (data.fieldDefinitions as unknown[]) ?? [],
          customFields: (data.customFields as Record<string, unknown>) ?? {}
        });

        return assetRecord;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        if (!assetRecord || assetRecord.id !== where.id) {
          throw new Error("Asset not found.");
        }

        assetRecord = buildAssetRecord({
          ...assetRecord,
          ...data,
          updatedAt: new Date("2026-03-17T00:00:00.000Z")
        });

        return assetRecord;
      }
    }
  } as never);

  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = {
      userId,
      clerkUserId: null,
      source: "dev-bypass"
    };
  });

  await app.register(assetRoutes);

  return { app };
};

describe("asset CRUD integration", () => {
  it("creates, reads, updates, and soft-deletes an asset", async () => {
    const { app } = await createApp();

    try {
      const createResponse = await app.inject({
        method: "POST",
        url: "/v1/assets",
        payload: {
          householdId,
          name: "Generator",
          category: "home",
          visibility: "shared",
          assetTypeSource: "manual",
          assetTypeVersion: 1,
          fieldDefinitions: [],
          customFields: {}
        }
      });

      expect(createResponse.statusCode).toBe(201);
      expect(createResponse.json()).toMatchObject({
        name: "Generator",
        category: "home",
        assetTag: "LK-ASSETTEST01",
        deletedAt: null
      });

      const createdAssetId = createResponse.json().id as string;

      const getResponse = await app.inject({
        method: "GET",
        url: `/v1/assets/${createdAssetId}`
      });

      expect(getResponse.statusCode).toBe(200);
      expect(getResponse.json()).toMatchObject({
        id: createdAssetId,
        name: "Generator"
      });

      const updateResponse = await app.inject({
        method: "PATCH",
        url: `/v1/assets/${createdAssetId}`,
        payload: {
          manufacturer: "Honda"
        }
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json()).toMatchObject({
        id: createdAssetId,
        manufacturer: "Honda"
      });

      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/v1/assets/${createdAssetId}`
      });

      expect(deleteResponse.statusCode).toBe(200);
      expect(deleteResponse.json().deletedAt).toBeTruthy();
    } finally {
      await app.close();
    }
  });
});