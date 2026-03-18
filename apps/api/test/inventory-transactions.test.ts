import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const inventoryMocks = vi.hoisted(() => {
  class TestInventoryError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }

  return {
    applyInventoryTransaction: vi.fn(),
    createInventoryTransactionCorrection: vi.fn(),
    getHouseholdInventoryItem: vi.fn(),
    InventoryError: TestInventoryError
  };
});

vi.mock("../src/lib/inventory.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/inventory.js")>();

  return {
    ...actual,
    applyInventoryTransaction: inventoryMocks.applyInventoryTransaction,
    createInventoryTransactionCorrection: inventoryMocks.createInventoryTransactionCorrection,
    getHouseholdInventoryItem: inventoryMocks.getHouseholdInventoryItem,
    InventoryError: inventoryMocks.InventoryError
  };
});

import { householdInventoryTransactionRoutes } from "../src/routes/households/inventory-transactions.js";

const householdId = "clkeeperhouse000000000001";
const userId = "clkeeperuser0000000000001";
const inventoryItemId = "clkeeperitem0000000000001";

const inventoryItem = {
  id: inventoryItemId,
  householdId,
  itemType: "consumable",
  conditionStatus: null,
  name: "Oil Filter",
  partNumber: "OF-123",
  description: null,
  category: "Filters",
  manufacturer: "Acme",
  quantityOnHand: 2,
  unit: "each",
  reorderThreshold: 3,
  reorderQuantity: 6,
  preferredSupplier: null,
  supplierUrl: null,
  unitCost: 12.5,
  storageLocation: null,
  notes: null,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z")
};

const createApp = async () => {
  const app = Fastify();

  app.decorate("prisma", {
    householdMember: {
      findUnique: async () => ({ householdId, userId, role: "owner" })
    },
    maintenanceLog: {
      findMany: async () => [
        {
          id: "clkeeperlog0000000000002",
          title: "Oil change",
          assetId: "clkeeperasset00000000001",
          asset: {
            name: "Truck"
          }
        },
        {
          id: "clkeeperlog0000000000003",
          title: "Filter service",
          assetId: "clkeeperasset00000000001",
          asset: {
            name: "Truck"
          }
        }
      ]
    },
    project: {
      findMany: async () => []
    },
    hobbySession: {
      findMany: async () => []
    },
    inventoryTransaction: {
      findMany: async () => [
        {
          id: "clkeepertxn0000000000002",
          inventoryItemId,
          type: "consume",
          quantity: 1,
          quantityAfter: 1,
          referenceType: "maintenance_log",
          referenceId: "clkeeperlog0000000000002",
          unitCost: 12.5,
          notes: "Used for service",
          userId,
          createdAt: new Date("2026-03-18T00:00:00.000Z"),
          inventoryItem: {
            name: "Oil Filter",
            partNumber: "OF-123"
          }
        },
        {
          id: "clkeepertxn0000000000001",
          inventoryItemId,
          type: "purchase",
          quantity: 4,
          quantityAfter: 2,
          referenceType: null,
          referenceId: null,
          unitCost: 11.75,
          notes: "Restock",
          userId,
          createdAt: new Date("2026-03-17T00:00:00.000Z"),
          inventoryItem: {
            name: "Oil Filter",
            partNumber: "OF-123"
          }
        }
      ]
    },
    activityLog: {
      create: async () => ({ id: "clkeeperactivity00000000001" })
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

  await app.register(householdInventoryTransactionRoutes);

  return app;
};

beforeEach(() => {
  inventoryMocks.getHouseholdInventoryItem.mockResolvedValue(inventoryItem);
  inventoryMocks.applyInventoryTransaction.mockResolvedValue({
    transaction: {
      id: "clkeepertxn0000000000003",
      inventoryItemId,
      type: "consume",
      quantity: 1,
      quantityAfter: 1,
      referenceType: "maintenance_log",
      referenceId: "clkeeperlog0000000000003",
      unitCost: 12.5,
      notes: "Consumed by maintenance",
      userId,
      createdAt: new Date("2026-03-18T08:00:00.000Z")
    },
    item: {
      ...inventoryItem,
      quantityOnHand: 1,
      updatedAt: new Date("2026-03-18T08:00:00.000Z")
    },
    lowStock: true
  });
  inventoryMocks.createInventoryTransactionCorrection.mockResolvedValue({
    transaction: {
      id: "clkeepertxn0000000000004",
      inventoryItemId,
      type: "correction",
      quantity: 9,
      quantityAfter: 10,
      referenceType: "inventory_transaction",
      referenceId: "clkeepertxn0000000000002",
      correctionOfTransactionId: "clkeepertxn0000000000002",
      unitCost: 12.5,
      notes: "Corrected accidental over-consumption",
      userId,
      createdAt: new Date("2026-03-18T09:00:00.000Z")
    },
    item: {
      ...inventoryItem,
      quantityOnHand: 10,
      updatedAt: new Date("2026-03-18T09:00:00.000Z")
    }
  });
});

describe("household inventory transaction routes", () => {
  it("lists household transactions with item details and cursor pagination", async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/inventory/transactions?limit=1`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        transactions: [
          {
            id: "clkeepertxn0000000000002",
            itemName: "Oil Filter",
            itemPartNumber: "OF-123",
            type: "consume",
            referenceLink: {
              href: "/assets/clkeeperasset00000000001/maintenance#maintenance-log-clkeeperlog0000000000002",
              label: "Oil change",
              secondaryLabel: "Truck"
            }
          }
        ],
        nextCursor: "clkeepertxn0000000000002"
      });
    } finally {
      await app.close();
    }
  });

  it("creates a consume transaction and returns the low stock warning", async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/inventory/${inventoryItemId}/transactions`,
        payload: {
          type: "consume",
          quantity: 1,
          unitCost: 12.5,
          referenceType: "maintenance_log",
          referenceId: "clkeeperlog0000000000003",
          notes: "Consumed by maintenance"
        }
      });

      expect(response.statusCode).toBe(201);
      expect(inventoryMocks.applyInventoryTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          inventoryItemId,
          userId,
          input: expect.objectContaining({
            type: "consume",
            quantity: 1
          })
        })
      );
      expect(response.json()).toMatchObject({
        transaction: {
          id: "clkeepertxn0000000000003",
          type: "consume",
          quantityAfter: 1,
          referenceLink: {
            href: "/assets/clkeeperasset00000000001/maintenance#maintenance-log-clkeeperlog0000000000003",
            label: "Filter service",
            secondaryLabel: "Truck"
          }
        },
        inventoryItem: {
          id: inventoryItemId,
          quantityOnHand: 1,
          lowStock: true
        },
        lowStockWarning: true
      });
    } finally {
      await app.close();
    }
  });

  it("returns a 400 when stock is insufficient for a consume transaction", async () => {
    inventoryMocks.applyInventoryTransaction.mockRejectedValueOnce(
      new inventoryMocks.InventoryError("INSUFFICIENT_STOCK", "Not enough stock on hand.")
    );

    const app = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/inventory/${inventoryItemId}/transactions`,
        payload: {
          type: "consume",
          quantity: 5
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe("Not enough stock on hand.");
    } finally {
      await app.close();
    }
  });

  it("creates a linked correction transaction for an existing inventory entry", async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/inventory/transactions/clkeepertxn0000000000002/corrections`,
        payload: {
          replacementQuantity: -1,
          notes: "Corrected accidental over-consumption"
        }
      });

      expect(response.statusCode).toBe(201);
      expect(inventoryMocks.createInventoryTransactionCorrection).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          householdId,
          transactionId: "clkeepertxn0000000000002",
          userId,
          input: {
            replacementQuantity: -1,
            notes: "Corrected accidental over-consumption"
          }
        })
      );
      expect(response.json()).toMatchObject({
        transaction: {
          id: "clkeepertxn0000000000004",
          type: "correction",
          referenceId: "clkeepertxn0000000000002",
          correctionOfTransactionId: "clkeepertxn0000000000002"
        },
        inventoryItem: {
          id: inventoryItemId,
          quantityOnHand: 10
        }
      });
    } finally {
      await app.close();
    }
  });

  it("returns a 404 when correcting a transaction that is not found", async () => {
    inventoryMocks.createInventoryTransactionCorrection.mockRejectedValueOnce(
      new inventoryMocks.InventoryError("INVENTORY_TRANSACTION_NOT_FOUND", "Inventory transaction not found.")
    );

    const app = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/inventory/transactions/clkeepertxn0000000000999/corrections`,
        payload: {
          replacementQuantity: 0
        }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().message).toBe("Inventory transaction not found.");
    } finally {
      await app.close();
    }
  });
});