import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchMocks = vi.hoisted(() => ({
  syncInventoryItemToSearchIndex: vi.fn(async () => undefined),
  removeSearchIndexEntry: vi.fn(async () => undefined)
}));

const eventMocks = vi.hoisted(() => ({
  emitDomainEvent: vi.fn(async () => ({ id: "clkeeperevent000000000001" }))
}));

const inventoryMocks = vi.hoisted(() => ({
  getHouseholdInventoryItem: vi.fn(),
  applyInventoryTransaction: vi.fn(),
  computeBulkSchedulePartsReadiness: vi.fn(),
  mergeHouseholdInventoryItems: vi.fn(),
  InventoryError: class TestInventoryError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
}));

vi.mock("../src/lib/search-index.js", () => ({
  syncInventoryItemToSearchIndex: searchMocks.syncInventoryItemToSearchIndex,
  removeSearchIndexEntry: searchMocks.removeSearchIndexEntry
}));

vi.mock("../src/lib/domain-events.js", () => ({
  emitDomainEvent: eventMocks.emitDomainEvent
}));

vi.mock("../src/lib/inventory.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/inventory.js")>();

  return {
    ...actual,
    getHouseholdInventoryItem: inventoryMocks.getHouseholdInventoryItem,
    applyInventoryTransaction: inventoryMocks.applyInventoryTransaction,
    computeBulkSchedulePartsReadiness: inventoryMocks.computeBulkSchedulePartsReadiness,
    mergeHouseholdInventoryItems: inventoryMocks.mergeHouseholdInventoryItems,
    InventoryError: inventoryMocks.InventoryError
  };
});

import { householdInventoryItemRoutes } from "../src/routes/households/inventory-items.js";

const householdId = "clkeeperhouse000000000001";
const targetInventoryItemId = "clkeeperitem0000000000001";
const sourceInventoryItemId = "clkeeperitem0000000000002";
const userId = "clkeeperuser0000000000001";

const restoredItem = {
  id: targetInventoryItemId,
  householdId,
  itemType: "consumable",
  conditionStatus: null,
  name: "Oil Filter",
  partNumber: "OF-123",
  description: null,
  category: "Filters",
  manufacturer: "Acme",
  quantityOnHand: 4,
  unit: "each",
  reorderThreshold: 2,
  reorderQuantity: 6,
  preferredSupplier: null,
  supplierUrl: null,
  unitCost: 12.5,
  storageLocation: null,
  notes: null,
  deletedAt: null,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-17T00:00:00.000Z")
};

const createApp = async () => {
  const app = Fastify();

  app.decorate("prisma", {
    householdMember: {
      findUnique: async () => ({ householdId, userId, role: "owner" })
    },
    inventoryItem: {
      fields: {
        reorderThreshold: Symbol("reorderThreshold")
      },
      findFirst: async ({ where }: { where: { id: string; householdId: string } }) => {
        if (where.id !== targetInventoryItemId) {
          return null;
        }

        return {
          ...restoredItem,
          deletedAt: new Date("2026-03-16T00:00:00.000Z")
        };
      },
      update: async ({ where, data }: { where: { id: string }; data: { deletedAt: Date | null } }) => ({
        ...restoredItem,
        id: where.id,
        deletedAt: data.deletedAt,
        updatedAt: new Date("2026-03-17T12:00:00.000Z")
      })
    },
    activityLog: {
      create: async () => ({ id: "clkeeperactivity00000000001" })
    },
    maintenanceSchedule: {
      findMany: async () => []
    },
    $transaction: async <T>(callback: (tx: object) => Promise<T>) => callback({})
  } as never);

  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = {
      userId,
      clerkUserId: null,
      source: "dev-bypass"
    };
  });

  await app.register(householdInventoryItemRoutes);

  return app;
};

beforeEach(() => {
  vi.clearAllMocks();
  inventoryMocks.computeBulkSchedulePartsReadiness.mockResolvedValue(new Map());
  inventoryMocks.mergeHouseholdInventoryItems.mockResolvedValue({
    sourceInventoryItemId,
    targetInventoryItem: {
      ...restoredItem,
      deletedAt: null,
      totalValue: 50,
      lowStock: false,
      createdAt: restoredItem.createdAt.toISOString(),
      updatedAt: new Date("2026-03-17T12:00:00.000Z").toISOString()
    },
    reassignedCounts: {
      transactions: 3,
      purchaseLines: 1,
      assetLinks: 1,
      scheduleLinks: 1,
      projectLinks: 0,
      hobbyLinks: 0,
      maintenanceLogParts: 0,
      projectPhaseSupplies: 0,
      hobbyRecipeIngredients: 0,
      hobbySessionIngredients: 0,
      comments: 1
    }
  });
});

describe("household inventory item routes", () => {
  it("restores a soft-deleted inventory item", async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/inventory/${targetInventoryItemId}/restore`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        id: targetInventoryItemId,
        name: "Oil Filter",
        deletedAt: null,
        lowStock: false
      });
      expect(eventMocks.emitDomainEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: "inventory_item.restored",
          entityId: targetInventoryItemId
        })
      );
      expect(searchMocks.syncInventoryItemToSearchIndex).toHaveBeenCalledWith(expect.anything(), targetInventoryItemId);
    } finally {
      await app.close();
    }
  });

  it("merges one inventory item into another", async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/inventory/${targetInventoryItemId}/merge`,
        payload: {
          sourceInventoryItemId
        }
      });

      expect(response.statusCode).toBe(200);
      expect(inventoryMocks.mergeHouseholdInventoryItems).toHaveBeenCalledWith(
        expect.anything(),
        {
          householdId,
          targetInventoryItemId,
          sourceInventoryItemId
        }
      );
      expect(response.json()).toMatchObject({
        sourceInventoryItemId,
        targetInventoryItem: {
          id: targetInventoryItemId,
          quantityOnHand: 4
        },
        reassignedCounts: {
          transactions: 3,
          assetLinks: 1,
          scheduleLinks: 1,
          comments: 1
        }
      });
      expect(eventMocks.emitDomainEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: "inventory_item.merged",
          entityId: targetInventoryItemId
        })
      );
      expect(searchMocks.removeSearchIndexEntry).toHaveBeenCalledWith(expect.anything(), "inventory_item", sourceInventoryItemId);
      expect(searchMocks.syncInventoryItemToSearchIndex).toHaveBeenCalledWith(expect.anything(), targetInventoryItemId);
    } finally {
      await app.close();
    }
  });

  it("returns a 400 for incompatible inventory merges", async () => {
    inventoryMocks.mergeHouseholdInventoryItems.mockRejectedValueOnce(
      new inventoryMocks.InventoryError("INVENTORY_ITEM_MERGE_UNIT_MISMATCH", "Inventory items with different units cannot be merged.")
    );

    const app = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/inventory/${targetInventoryItemId}/merge`,
        payload: {
          sourceInventoryItemId
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        message: "Inventory items with different units cannot be merged."
      });
    } finally {
      await app.close();
    }
  });
});