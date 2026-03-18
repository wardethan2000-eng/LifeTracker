import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchMocks = vi.hoisted(() => ({
  removeSearchIndexEntry: vi.fn(async () => undefined),
  syncSpaceToSearchIndex: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/search-index.js", () => ({
  removeSearchIndexEntry: searchMocks.removeSearchIndexEntry,
  syncSpaceToSearchIndex: searchMocks.syncSpaceToSearchIndex
}));

import { householdSpaceRoutes } from "../src/routes/households/spaces.js";

const householdId = "clkeeperhouse000000000001";
const spaceId = "clkeeperspace000000000001";
const inventoryItemId = "clkeeperitem0000000000001";
const userId = "clkeeperuser0000000000001";

const createSpace = () => ({
  id: spaceId,
  householdId,
  shortCode: "A3K7",
  scanTag: "sp_TESTSPACE01",
  name: "Garage Shelf",
  type: "shelf" as const,
  parentSpaceId: null,
  description: null,
  notes: null,
  sortOrder: 0,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  deletedAt: null
});

const createInventoryItem = () => ({
  id: inventoryItemId,
  householdId,
  scanTag: "inv_TESTITEM01",
  itemType: "consumable",
  conditionStatus: null,
  name: "Oil Filter",
  partNumber: "OF-123",
  description: null,
  category: "Filters",
  manufacturer: "Acme",
  quantityOnHand: 4,
  unit: "each",
  reorderThreshold: null,
  reorderQuantity: null,
  preferredSupplier: null,
  supplierUrl: null,
  unitCost: null,
  storageLocation: null,
  notes: null,
  deletedAt: null,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-17T00:00:00.000Z")
});

const createApp = async (options?: {
  existingLink?: { quantity: number | null; notes: string | null } | null;
  historySeed?: Array<{
    id: string;
    action: "placed" | "removed" | "moved_in" | "moved_out" | "quantity_changed";
    createdAt: Date;
    quantity?: number | null;
    previousQuantity?: number | null;
    notes?: string | null;
  }>;
}) => {
  const app = Fastify();
  const space = createSpace();
  const inventoryItem = createInventoryItem();
  let link = options?.existingLink
    ? {
        id: "clkeeperspaceitem00000000001",
        spaceId,
        inventoryItemId,
        quantity: options.existingLink.quantity,
        notes: options.existingLink.notes,
        placedAt: new Date("2026-03-15T12:00:00.000Z"),
        createdAt: new Date("2026-03-15T12:00:00.000Z"),
        updatedAt: new Date("2026-03-15T12:00:00.000Z")
      }
    : null;

  const history = (options?.historySeed ?? []).map((entry) => ({
    id: entry.id,
    spaceId,
    inventoryItemId,
    generalItemName: null,
    householdId,
    action: entry.action,
    quantity: entry.quantity ?? null,
    previousQuantity: entry.previousQuantity ?? null,
    performedBy: userId,
    notes: entry.notes ?? null,
    createdAt: entry.createdAt,
    inventoryItem,
    performer: {
      id: userId,
      displayName: "Casey"
    },
    space
  }));

  const prisma = {
    householdMember: {
      findUnique: async () => ({ householdId, userId, role: "owner" })
    },
    space: {
      findFirst: async ({ where }: { where: { id?: string; householdId?: string; deletedAt?: null } }) => {
        if (where.id && where.id !== space.id) {
          return null;
        }

        if (where.householdId && where.householdId !== householdId) {
          return null;
        }

        return space;
      },
      findUnique: async ({ where }: { where: { id?: string; scanTag?: string } }) => {
        if (where.id && where.id !== space.id) {
          return null;
        }

        if (where.scanTag && where.scanTag !== space.scanTag) {
          return null;
        }

        return {
          id: space.id,
          name: space.name,
          type: space.type,
          parentSpaceId: space.parentSpaceId,
          scanTag: space.scanTag
        };
      }
    },
    inventoryItem: {
      findFirst: async ({ where }: { where: { id?: string; householdId?: string; deletedAt?: null } }) => {
        if (where.id !== inventoryItem.id || where.householdId !== householdId) {
          return null;
        }

        return inventoryItem;
      }
    },
    spaceInventoryItem: {
      findUnique: async ({ where }: { where: { spaceId_inventoryItemId: { spaceId: string; inventoryItemId: string } } }) => {
        const matches = link
          && where.spaceId_inventoryItemId.spaceId === spaceId
          && where.spaceId_inventoryItemId.inventoryItemId === inventoryItemId;

        return matches ? { ...link } : null;
      },
      upsert: async ({ update, create }: { update: { quantity: number | null; notes: string | null }; create: { quantity: number | null; notes: string | null } }) => {
        const next = link
          ? { ...link, quantity: update.quantity, notes: update.notes, updatedAt: new Date("2026-03-18T10:00:00.000Z") }
          : {
              id: "clkeeperspaceitem00000000001",
              spaceId,
              inventoryItemId,
              quantity: create.quantity,
              notes: create.notes,
              placedAt: new Date("2026-03-18T10:00:00.000Z"),
              createdAt: new Date("2026-03-18T10:00:00.000Z"),
              updatedAt: new Date("2026-03-18T10:00:00.000Z")
            };

        link = next;

        return {
          ...next,
          inventoryItem
        };
      },
      delete: async () => {
        link = null;
      }
    },
    spaceItemHistory: {
      findFirst: async ({ where }: { where: { householdId: string; inventoryItemId: string; performedBy: string; action: { in: string[] }; createdAt: { gte: Date } } }) => {
        const match = [...history]
          .filter((entry) => entry.householdId === where.householdId
            && entry.inventoryItemId === where.inventoryItemId
            && entry.performedBy === where.performedBy
            && where.action.in.includes(entry.action)
            && entry.createdAt >= where.createdAt.gte)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];

        return match ?? null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const created = {
          id: `clkeeperhistory0000000000${history.length + 1}`,
          spaceId: String(data.spaceId),
          inventoryItemId: typeof data.inventoryItemId === "string" ? data.inventoryItemId : null,
          generalItemName: typeof data.generalItemName === "string" ? data.generalItemName : null,
          householdId: String(data.householdId),
          action: String(data.action),
          quantity: typeof data.quantity === "number" ? data.quantity : null,
          previousQuantity: typeof data.previousQuantity === "number" ? data.previousQuantity : null,
          performedBy: typeof data.performedBy === "string" ? data.performedBy : null,
          notes: typeof data.notes === "string" ? data.notes : null,
          createdAt: new Date("2026-03-18T10:00:00.000Z"),
          inventoryItem,
          performer: {
            id: userId,
            displayName: "Casey"
          },
          space
        };

        history.push(created);
        return created;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const target = history.find((entry) => entry.id === where.id);

        if (!target) {
          throw new Error("History entry not found.");
        }

        if (typeof data.action === "string") {
          target.action = data.action;
        }

        if ("previousQuantity" in data) {
          target.previousQuantity = typeof data.previousQuantity === "number" ? data.previousQuantity : null;
        }

        if ("quantity" in data) {
          target.quantity = typeof data.quantity === "number" ? data.quantity : null;
        }

        if ("notes" in data) {
          target.notes = typeof data.notes === "string" ? data.notes : null;
        }

        return target;
      },
      findMany: async ({ where, take, cursor }: { where: { householdId: string; spaceId: string; action?: { in: string[] }; createdAt?: { gte?: Date; lte?: Date } }; take: number; cursor?: { id: string } }) => {
        const filtered = history
          .filter((entry) => entry.householdId === where.householdId && entry.spaceId === where.spaceId)
          .filter((entry) => !where.action || where.action.in.includes(entry.action))
          .filter((entry) => !where.createdAt?.gte || entry.createdAt >= where.createdAt.gte)
          .filter((entry) => !where.createdAt?.lte || entry.createdAt <= where.createdAt.lte)
          .sort((left, right) => {
            if (left.createdAt.getTime() !== right.createdAt.getTime()) {
              return right.createdAt.getTime() - left.createdAt.getTime();
            }

            return right.id.localeCompare(left.id);
          });

        const startIndex = cursor
          ? filtered.findIndex((entry) => entry.id === cursor.id) + 1
          : 0;

        return filtered.slice(Math.max(startIndex, 0), Math.max(startIndex, 0) + take);
      }
    },
    activityLog: {
      create: async () => ({ id: "clkeeperactivity00000000001" })
    }
  };

  app.decorate("prisma", {
    ...prisma,
    $transaction: async <T,>(callback: (tx: typeof prisma) => Promise<T>) => callback(prisma)
  } as never);
  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = {
      userId,
      clerkUserId: null,
      source: "dev-bypass"
    };
  });

  await app.register(householdSpaceRoutes);

  return {
    app,
    history
  };
};

describe("space item history routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a placed history entry when assigning an inventory item to a space", async () => {
    const { app, history } = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/spaces/${spaceId}/items`,
        payload: {
          inventoryItemId
        }
      });

      expect(response.statusCode).toBe(201);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        householdId,
        spaceId,
        inventoryItemId,
        action: "placed",
        quantity: null,
        previousQuantity: null,
        performedBy: userId
      });
    } finally {
      await app.close();
    }
  });

  it("records a removed history entry when removing an inventory item from a space", async () => {
    const { app, history } = await createApp({
      existingLink: {
        quantity: 2,
        notes: "Top shelf"
      }
    });

    try {
      const response = await app.inject({
        method: "DELETE",
        url: `/v1/households/${householdId}/spaces/${spaceId}/items/${inventoryItemId}`
      });

      expect(response.statusCode).toBe(204);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        action: "removed",
        quantity: 2,
        notes: "Top shelf",
        inventoryItemId
      });
    } finally {
      await app.close();
    }
  });

  it("returns filtered space history with pagination metadata", async () => {
    const { app } = await createApp({
      historySeed: [
        {
          id: "clkeeperhistory00000000001",
          action: "removed",
          quantity: 1,
          notes: "Moved to bench",
          createdAt: new Date("2026-03-18T10:00:00.000Z")
        },
        {
          id: "clkeeperhistory00000000002",
          action: "removed",
          quantity: 2,
          notes: "Archived",
          createdAt: new Date("2026-03-17T10:00:00.000Z")
        }
      ]
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/spaces/${spaceId}/history?actions=removed&limit=1`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        items: [{
          action: "removed",
          itemName: "Oil Filter",
          notes: "Moved to bench",
          space: {
            id: spaceId,
            breadcrumb: [{
              id: spaceId,
              name: "Garage Shelf"
            }]
          }
        }],
        nextCursor: "clkeeperhistory00000000002"
      });
    } finally {
      await app.close();
    }
  });
});