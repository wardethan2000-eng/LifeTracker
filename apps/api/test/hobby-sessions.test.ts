import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const inventoryMocks = vi.hoisted(() => ({
  applyInventoryTransaction: vi.fn(),
}));

const activityMocks = vi.hoisted(() => ({
  logActivity: vi.fn(async () => ({ id: "clkeeperactivity00000000001" })),
}));

vi.mock("../src/lib/inventory.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/inventory.js")>();

  return {
    ...actual,
    applyInventoryTransaction: inventoryMocks.applyInventoryTransaction,
  };
});

vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: activityMocks.logActivity,
}));

import { hobbySessionRoutes } from "../src/routes/hobbies/sessions.js";

const householdId = "clkeeperhouse000000000001";
const hobbyId = "clkeeperhobby000000000001";
const recipeId = "clkeeperrecipe00000000001";
const sessionId = "clkeepersession0000000001";
const inventoryItemId = "clkeeperitem0000000000001";
const userId = "clkeeperuser0000000000001";

const sessionRecord = {
  id: sessionId,
  hobbyId,
  recipeId,
  name: "Spring IPA",
  status: "active",
  startDate: new Date("2026-03-17T00:00:00.000Z"),
  completedDate: null,
  pipelineStepId: null,
  customFields: {},
  totalCost: null,
  rating: null,
  notes: null,
  createdAt: new Date("2026-03-17T00:00:00.000Z"),
  updatedAt: new Date("2026-03-17T00:00:00.000Z")
};

const createApp = async (prisma: object) => {
  const app = Fastify();

  app.decorate("prisma", prisma as never);
  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = {
      userId,
      clerkUserId: null,
      source: "dev-bypass"
    };
  });

  await app.register(hobbySessionRoutes);

  return app;
};

beforeEach(() => {
  vi.clearAllMocks();
  inventoryMocks.applyInventoryTransaction.mockResolvedValue({
    transaction: { id: "clkeepertxn0000000000001" },
    item: { id: inventoryItemId, quantityOnHand: 3 },
    stockClamped: false,
    lowStock: false,
  });
});

describe("hobby session routes", () => {
  it("creates inventory transactions for recipe ingredients when creating a session", async () => {
    const tx = {
      hobbySession: {
        create: vi.fn(async () => sessionRecord),
        update: vi.fn(async () => sessionRecord),
        findUniqueOrThrow: vi.fn(async () => sessionRecord),
      },
      hobbyRecipe: {
        findUnique: vi.fn(async () => ({
          id: recipeId,
          customFields: {},
          ingredients: [
            {
              id: "clkeeperrecipeing000000001",
              inventoryItemId,
              name: "Hops",
              quantity: 2,
              unit: "oz",
              notes: null,
              sortOrder: 0,
            },
            {
              id: "clkeeperrecipeing000000002",
              inventoryItemId: null,
              name: "Water",
              quantity: 5,
              unit: "gal",
              notes: null,
              sortOrder: 1,
            }
          ],
          steps: []
        }))
      },
      hobbySessionIngredient: {
        createMany: vi.fn(async () => ({ count: 2 }))
      },
      hobbySessionStep: {
        createMany: vi.fn(async () => ({ count: 0 }))
      }
    };

    const app = await createApp({
      householdMember: {
        findUnique: async () => ({ householdId, userId, role: "owner" })
      },
      hobby: {
        findFirst: async () => ({ id: hobbyId, householdId, lifecycleMode: "binary", statusPipeline: [] })
      },
      $transaction: async <T>(callback: (prismaTx: typeof tx) => Promise<T>) => callback(tx)
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions`,
        payload: {
          recipeId,
          name: "Spring IPA",
          startDate: "2026-03-17T00:00:00.000Z"
        }
      });

      expect(response.statusCode).toBe(201);
      expect(tx.hobbySessionIngredient.createMany).toHaveBeenCalledTimes(1);
      expect(inventoryMocks.applyInventoryTransaction).toHaveBeenCalledTimes(1);
      expect(inventoryMocks.applyInventoryTransaction).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          inventoryItemId,
          userId,
          input: expect.objectContaining({
            type: "consume",
            quantity: -2,
            referenceType: "hobby_session",
            referenceId: sessionId,
          })
        })
      );
    } finally {
      await app.close();
    }
  });

  it("restocks linked ingredients when deleting a session", async () => {
    const tx = {
      hobbySession: {
        delete: vi.fn(async () => undefined)
      }
    };

    const app = await createApp({
      householdMember: {
        findUnique: async () => ({ householdId, userId, role: "owner" })
      },
      hobbySession: {
        findFirst: async () => ({
          ...sessionRecord,
          ingredients: [
            {
              inventoryItemId,
              quantityUsed: 1.5,
            },
            {
              inventoryItemId: null,
              quantityUsed: 3,
            }
          ]
        })
      },
      $transaction: async <T>(callback: (prismaTx: typeof tx) => Promise<T>) => callback(tx)
    });

    try {
      const response = await app.inject({
        method: "DELETE",
        url: `/v1/households/${householdId}/hobbies/${hobbyId}/sessions/${sessionId}`
      });

      expect(response.statusCode).toBe(204);
      expect(inventoryMocks.applyInventoryTransaction).toHaveBeenCalledTimes(1);
      expect(inventoryMocks.applyInventoryTransaction).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          inventoryItemId,
          userId,
          input: expect.objectContaining({
            type: "adjust",
            quantity: 1.5,
            referenceType: "hobby_session",
            referenceId: sessionId,
          })
        })
      );
      expect(tx.hobbySession.delete).toHaveBeenCalledWith({ where: { id: sessionId } });
    } finally {
      await app.close();
    }
  });
});