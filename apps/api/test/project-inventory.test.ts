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
    getHouseholdInventoryItem: vi.fn(),
    InventoryError: TestInventoryError
  };
});

vi.mock("../src/lib/inventory.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/inventory.js")>();

  return {
    ...actual,
    applyInventoryTransaction: inventoryMocks.applyInventoryTransaction,
    getHouseholdInventoryItem: inventoryMocks.getHouseholdInventoryItem,
    InventoryError: inventoryMocks.InventoryError
  };
});

import { projectInventoryRoutes } from "../src/routes/projects/inventory.js";

const householdId = "clkeeperhouse000000000001";
const projectId = "clkeeperproject0000000001";
const inventoryItemId = "clkeeperitem0000000000001";
const userId = "clkeeperuser0000000000001";

const project = {
  id: projectId,
  householdId,
  name: "Garage Refresh",
  deletedAt: null
};

const inventoryItem = {
  id: inventoryItemId,
  householdId,
  itemType: "consumable",
  conditionStatus: null,
  name: "Drywall Screws",
  partNumber: "SCR-100",
  description: null,
  category: "Hardware",
  manufacturer: null,
  quantityOnHand: 20,
  unit: "each",
  reorderThreshold: 5,
  reorderQuantity: 50,
  preferredSupplier: null,
  supplierUrl: null,
  unitCost: 0.12,
  storageLocation: null,
  notes: null,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z")
};

const createApp = async (quantityAllocated: number) => {
  const deleteMock = vi.fn(async () => undefined);
  const app = Fastify();

  app.decorate("prisma", {
    householdMember: {
      findUnique: async () => ({ householdId, userId, role: "owner" })
    },
    project: {
      findFirst: async () => project
    },
    projectInventoryItem: {
      findUnique: async () => ({
        id: "clkeeperprojectinventory0001",
        projectId,
        inventoryItemId,
        quantityNeeded: 12,
        quantityAllocated,
        budgetedUnitCost: 0.15,
        notes: null,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-01T00:00:00.000Z")
      })
    },
    $transaction: async <T>(callback: (tx: { projectInventoryItem: { delete: typeof deleteMock } }) => Promise<T>) => callback({
      projectInventoryItem: {
        delete: deleteMock
      }
    })
  } as never);

  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = {
      userId,
      clerkUserId: null,
      source: "dev-bypass"
    };
  });

  await app.register(projectInventoryRoutes);

  return { app, deleteMock };
};

beforeEach(() => {
  vi.clearAllMocks();
  inventoryMocks.getHouseholdInventoryItem.mockResolvedValue(inventoryItem);
  inventoryMocks.applyInventoryTransaction.mockResolvedValue({
    item: {
      ...inventoryItem,
      quantityOnHand: 30
    },
    transaction: {
      id: "clkeepertxn0000000000100",
      inventoryItemId,
      type: "return",
      quantity: 10,
      quantityAfter: 30,
      referenceType: "project",
      referenceId: projectId,
      correctionOfTransactionId: null,
      unitCost: 0.15,
      notes: "Returned allocated inventory after removing Garage Refresh inventory link.",
      userId,
      createdAt: new Date("2026-03-17T00:00:00.000Z")
    },
    lowStock: false,
    stockClamped: false
  });
});

describe("project inventory routes", () => {
  it("returns allocated stock before deleting a project inventory link", async () => {
    const { app, deleteMock } = await createApp(10);

    try {
      const response = await app.inject({
        method: "DELETE",
        url: `/v1/households/${householdId}/projects/${projectId}/inventory/${inventoryItemId}`
      });

      expect(response.statusCode).toBe(204);
      expect(inventoryMocks.applyInventoryTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          inventoryItemId,
          userId,
          input: expect.objectContaining({
            type: "return",
            quantity: 10,
            referenceType: "project",
            referenceId: projectId
          })
        })
      );
      expect(deleteMock).toHaveBeenCalledWith({ where: { id: "clkeeperprojectinventory0001" } });
    } finally {
      await app.close();
    }
  });

  it("deletes the link without a stock transaction when nothing was allocated", async () => {
    const { app, deleteMock } = await createApp(0);

    try {
      const response = await app.inject({
        method: "DELETE",
        url: `/v1/households/${householdId}/projects/${projectId}/inventory/${inventoryItemId}`
      });

      expect(response.statusCode).toBe(204);
      expect(inventoryMocks.applyInventoryTransaction).not.toHaveBeenCalled();
      expect(deleteMock).toHaveBeenCalledWith({ where: { id: "clkeeperprojectinventory0001" } });
    } finally {
      await app.close();
    }
  });
});