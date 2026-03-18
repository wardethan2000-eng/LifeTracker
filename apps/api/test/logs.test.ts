import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

const maintenanceLogMocks = vi.hoisted(() => ({
  syncScheduleCompletionFromLogs: vi.fn(),
  toMaintenanceLogResponse: vi.fn((log: { id: string; title: string }, parts: Array<{ id: string; name: string; quantity: number }> = []) => ({
    id: log.id,
    title: log.title,
    parts
  }))
}));

vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/queues.js", () => ({
  enqueueNotificationScan: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/search-index.js", () => ({
  syncLogToSearchIndex: vi.fn(async () => undefined),
  syncScheduleToSearchIndex: vi.fn(async () => undefined),
  removeSearchIndexEntry: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/domain-events.js", () => ({
  emitDomainEvent: vi.fn(async () => undefined)
}));

vi.mock("../src/lib/maintenance-logs.js", () => ({
  syncScheduleCompletionFromLogs: maintenanceLogMocks.syncScheduleCompletionFromLogs,
  toMaintenanceLogResponse: maintenanceLogMocks.toMaintenanceLogResponse
}));

import { maintenanceLogRoutes } from "../src/routes/logs/index.js";

const householdId = "clkeeperhouse000000000001";
const userId = "clkeeperuser0000000000001";
const assetId = "clkeeperasset0000000000001";
const scheduleId = "clkeeperschedule000000000001";
const inventoryItemId = "clkeeperinventory000000001";

const createApp = async () => {
  const app = Fastify();
  const createdParts: Array<{
    id: string;
    logId: string;
    inventoryItemId: string | null;
    name: string;
    partNumber: string | null;
    quantity: number;
    unitCost: number | null;
    supplier: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  let quantityOnHand = 2;
  let unitCost = 12.5;

  const logCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "clkeeperlog00000000000001",
    assetId,
    scheduleId: (data.scheduleId as string | null | undefined) ?? null,
    completedById: userId,
    serviceProviderId: null,
    title: data.title as string,
    notes: (data.notes as string | undefined) ?? null,
    completedAt: data.completedAt as Date,
    usageValue: (data.usageValue as number | undefined) ?? null,
    cost: (data.cost as number | undefined) ?? null,
    laborHours: null,
    laborRate: null,
    difficultyRating: null,
    performedBy: null,
    metadata: (data.metadata as Record<string, unknown>) ?? {},
    deletedAt: null,
    createdAt: new Date("2026-03-17T10:00:00.000Z"),
    updatedAt: new Date("2026-03-17T10:00:00.000Z")
  }));

  const maintenanceLogPartCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const part = {
      id: `clkeeperpart${String(createdParts.length + 1).padStart(8, "0")}`,
      logId: data.logId as string,
      inventoryItemId: (data.inventoryItemId as string | null | undefined) ?? null,
      name: data.name as string,
      partNumber: (data.partNumber as string | null | undefined) ?? null,
      quantity: data.quantity as number,
      unitCost: (data.unitCost as number | null | undefined) ?? null,
      supplier: (data.supplier as string | null | undefined) ?? null,
      notes: (data.notes as string | null | undefined) ?? null,
      createdAt: new Date("2026-03-17T10:00:00.000Z"),
      updatedAt: new Date("2026-03-17T10:00:00.000Z")
    };

    createdParts.push(part);
    return part;
  });

  const inventoryItemUpdate = vi.fn(async ({ data }: { data: { quantityOnHand: number; unitCost?: number } }) => {
    quantityOnHand = data.quantityOnHand;
    if (data.unitCost !== undefined) {
      unitCost = data.unitCost;
    }

    return {
      id: inventoryItemId,
      householdId,
      deletedAt: null,
      quantityOnHand,
      reorderThreshold: 1,
      unitCost
    };
  });

  const inventoryTransactionCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "clkeepertransaction0000001",
    ...data,
    createdAt: new Date("2026-03-17T10:00:00.000Z")
  }));

  const tx = {
    maintenanceSchedule: {
      findFirst: async ({ where }: { where: { id: string; assetId: string } }) => (
        where.id === scheduleId && where.assetId === assetId
          ? {
              id: scheduleId,
              name: "Oil change",
              inventoryItems: [
                {
                  inventoryItemId,
                  quantityPerService: 1,
                  notes: "Replace during service",
                  inventoryItem: {
                    name: "Oil filter",
                    partNumber: "OF-123",
                    unitCost: 12.5,
                    preferredSupplier: "AutoZone"
                  }
                }
              ]
            }
          : null
      )
    },
    maintenanceLog: {
      create: logCreate,
      findUniqueOrThrow: async () => ({
        id: "clkeeperlog00000000000001",
        assetId,
        scheduleId,
        completedById: userId,
        serviceProviderId: null,
        title: "Oil change",
        notes: null,
        completedAt: new Date("2026-03-17T10:00:00.000Z"),
        usageValue: null,
        cost: null,
        laborHours: null,
        laborRate: null,
        difficultyRating: null,
        performedBy: null,
        metadata: {},
        deletedAt: null,
        createdAt: new Date("2026-03-17T10:00:00.000Z"),
        updatedAt: new Date("2026-03-17T10:00:00.000Z"),
        parts: createdParts
      })
    },
    maintenanceLogPart: {
      create: maintenanceLogPartCreate
    },
    inventoryItem: {
      findFirst: async ({ where }: { where: { id: string; householdId: string; deletedAt: null } }) => (
        where.id === inventoryItemId && where.householdId === householdId
          ? {
              id: inventoryItemId,
              householdId,
              deletedAt: null,
              quantityOnHand,
              reorderThreshold: 1,
              unitCost
            }
          : null
      ),
      findUnique: async ({ where }: { where: { id: string } }) => (
        where.id === inventoryItemId
          ? {
              id: inventoryItemId,
              householdId,
              deletedAt: null,
              quantityOnHand,
              reorderThreshold: 1,
              unitCost
            }
          : null
      ),
      update: inventoryItemUpdate
    },
    inventoryTransaction: {
      create: inventoryTransactionCreate
    }
  };

  maintenanceLogMocks.syncScheduleCompletionFromLogs.mockResolvedValue({ id: scheduleId });

  app.decorate("prisma", {
    asset: {
      findFirst: async ({ where }: { where: { id?: string } }) => (
        where.id === assetId
          ? {
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
              manufacturer: "Ford",
              model: "F-150",
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
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-03-01T00:00:00.000Z")
            }
          : null
      )
    },
    maintenanceSchedule: tx.maintenanceSchedule,
    serviceProvider: {
      findFirst: async () => null
    },
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx)
  } as never);

  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = {
      userId,
      clerkUserId: null,
      source: "dev-bypass"
    };
  });

  await app.register(maintenanceLogRoutes);

  return {
    app,
    logCreate,
    maintenanceLogPartCreate,
    inventoryItemUpdate,
    inventoryTransactionCreate
  };
};

describe("maintenance log creation with schedule-linked parts", () => {
  it("creates linked parts and consumes inventory automatically when a schedule is attached", async () => {
    const {
      app,
      logCreate,
      maintenanceLogPartCreate,
      inventoryItemUpdate,
      inventoryTransactionCreate
    } = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/assets/${assetId}/logs`,
        payload: {
          scheduleId,
          completedAt: "2026-03-17T10:00:00.000Z",
          metadata: {}
        }
      });

      expect(response.statusCode).toBe(201);
      expect(logCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          title: "Oil change"
        })
      }));
      expect(maintenanceLogPartCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          inventoryItemId,
          name: "Oil filter",
          quantity: 1
        })
      }));
      expect(inventoryItemUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          quantityOnHand: 1,
          unitCost: 12.5
        })
      }));
      expect(inventoryTransactionCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          inventoryItemId,
          type: "consume",
          quantity: -1,
          referenceType: "maintenance_log"
        })
      }));
      expect(response.json()).toMatchObject({
        id: "clkeeperlog00000000000001",
        title: "Oil change",
        parts: [
          {
            name: "Oil filter",
            quantity: 1
          }
        ],
        inventoryWarnings: []
      });
    } finally {
      await app.close();
    }
  });
});