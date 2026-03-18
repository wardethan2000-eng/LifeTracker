import Fastify from "fastify";
import { beforeEach, describe, expect, it } from "vitest";
import { householdSpaceRoutes } from "../src/routes/households/spaces.js";

const householdId = "clkeeperhouse000000000001";
const roomId = "clkeeperspace000000000001";
const shelfId = "clkeeperspace000000000002";
const userId = "clkeeperuser0000000000001";

const inventoryItems = [
  {
    id: "clkeeperitem0000000000001",
    householdId,
    scanTag: null,
    itemType: "consumable" as const,
    conditionStatus: null,
    name: "Loose Fasteners",
    partNumber: "LF-10",
    description: "Bucket of mixed fasteners",
    category: "Hardware",
    manufacturer: null,
    quantityOnHand: 32,
    unit: "each",
    reorderThreshold: null,
    reorderQuantity: null,
    preferredSupplier: null,
    supplierUrl: null,
    unitCost: null,
    storageLocation: null,
    notes: null,
    createdAt: new Date("2026-03-10T00:00:00.000Z"),
    updatedAt: new Date("2026-03-11T00:00:00.000Z")
  }
];

const spaceRecords = [
  {
    id: roomId,
    householdId,
    shortCode: "RM01",
    scanTag: "sp_room01",
    name: "Workshop",
    type: "room" as const,
    parentSpaceId: null,
    description: null,
    notes: null,
    sortOrder: 0,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-02T00:00:00.000Z"),
    deletedAt: null,
    parent: null,
    children: [],
    spaceItems: [{
      id: "clkeeperspaceitem00000000001",
      spaceId: roomId,
      inventoryItemId: inventoryItems[0].id,
      quantity: 4,
      notes: null,
      placedAt: new Date("2026-03-12T00:00:00.000Z"),
      createdAt: new Date("2026-03-12T00:00:00.000Z"),
      updatedAt: new Date("2026-03-12T00:00:00.000Z"),
      inventoryItem: {
        ...inventoryItems[0],
        deletedAt: null
      }
    }],
    generalItems: []
  },
  {
    id: shelfId,
    householdId,
    shortCode: "SH01",
    scanTag: "sp_shelf01",
    name: "Left Shelf",
    type: "shelf" as const,
    parentSpaceId: roomId,
    description: null,
    notes: null,
    sortOrder: 0,
    createdAt: new Date("2026-03-03T00:00:00.000Z"),
    updatedAt: new Date("2026-03-04T00:00:00.000Z"),
    deletedAt: null,
    parent: null,
    children: [],
    spaceItems: [],
    generalItems: [{ id: "clkeepergeneralitem000000001", deletedAt: null }]
  }
];

const scanLogsSeed = [
  {
    id: "clkeeperscanlog00000000001",
    householdId,
    spaceId: roomId,
    userId,
    scannedAt: new Date("2026-03-18T09:00:00.000Z"),
    method: "qr_scan" as const,
    user: {
      id: userId,
      displayName: "Casey"
    },
    space: {
      id: roomId,
      householdId,
      shortCode: "RM01",
      scanTag: "sp_room01",
      name: "Workshop",
      type: "room" as const,
      parentSpaceId: null,
      description: null,
      notes: null,
      sortOrder: 0,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-02T00:00:00.000Z"),
      deletedAt: null
    }
  }
];

type ScanLogRecord = (typeof scanLogsSeed)[number] & {
  method: "qr_scan" | "manual_lookup" | "direct_navigation";
};

const createApp = async () => {
  const app = Fastify();
  const scanLogs: ScanLogRecord[] = [...scanLogsSeed];
  const prisma = {
    householdMember: {
      findUnique: async () => ({ householdId, userId, role: "owner" })
    },
    inventoryItem: {
      count: async () => inventoryItems.length,
      findMany: async () => [...inventoryItems]
    },
    space: {
      findFirst: async ({ where }: { where: { id?: string; householdId?: string; shortCode?: string; deletedAt?: null } }) => {
        return spaceRecords.find((space) => {
          if (where.id && space.id !== where.id) {
            return false;
          }

          if (where.householdId && space.householdId !== where.householdId) {
            return false;
          }

          if (where.shortCode && space.shortCode !== where.shortCode) {
            return false;
          }

          return true;
        }) ?? null;
      },
      findMany: async () => ([
        {
          ...spaceRecords[0],
          children: [],
          spaceItems: [{ id: "clkeeperspaceitem00000000001" }],
          generalItems: []
        },
        {
          ...spaceRecords[1],
          children: [],
          spaceItems: [],
          generalItems: [{ id: "clkeepergeneralitem000000001" }]
        }
      ]),
      findUnique: async ({ where }: { where: { id: string } }) => {
        const space = spaceRecords.find((entry) => entry.id === where.id);

        if (!space) {
          return null;
        }

        return {
          id: space.id,
          name: space.name,
          type: space.type,
          parentSpaceId: space.parentSpaceId
        };
      }
    },
    spaceItemHistory: {
      groupBy: async () => ([
        { spaceId: roomId, _max: { createdAt: new Date("2026-03-18T08:30:00.000Z") } },
        { spaceId: shelfId, _max: { createdAt: new Date("2026-03-17T07:15:00.000Z") } }
      ])
    },
    spaceScanLog: {
      findMany: async () => [...scanLogs],
      create: async ({ data }: { data: { householdId: string; spaceId: string; userId: string; method: string } }) => {
        scanLogs.push({
          id: `clkeeperscanlog0000000000${scanLogs.length + 1}`,
          householdId: data.householdId,
          spaceId: data.spaceId,
          userId: data.userId,
          scannedAt: new Date("2026-03-18T10:00:00.000Z"),
          method: data.method as ScanLogRecord["method"],
          user: {
            id: userId,
            displayName: "Casey"
          },
          space: {
            id: roomId,
            householdId,
            shortCode: "RM01",
            scanTag: "sp_room01",
            name: "Workshop",
            type: "room",
            parentSpaceId: null,
            description: null,
            notes: null,
            sortOrder: 0,
            createdAt: new Date("2026-03-01T00:00:00.000Z"),
            updatedAt: new Date("2026-03-02T00:00:00.000Z"),
            deletedAt: null
          }
        });
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
    (request as typeof request & { auth: { userId: string; clerkUserId: null; source: string } }).auth = {
      userId,
      clerkUserId: null,
      source: "dev-bypass"
    };
  });

  await app.register(householdSpaceRoutes);

  return { app, scanLogs };
};

describe("space analytics routes", () => {
  beforeEach(() => {
    // no-op to keep per-test state isolated via createApp
  });

  it("returns orphan inventory items with the inventory list shape", async () => {
    const { app } = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/spaces/analytics/orphans`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        items: [{
          id: inventoryItems[0].id,
          name: "Loose Fasteners"
        }],
        nextCursor: null
      });
    } finally {
      await app.close();
    }
  });

  it("returns utilization analytics with recursive totals and last activity", async () => {
    const { app } = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/spaces/analytics/utilization`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject([
        {
          spaceId: roomId,
          totalItemCount: 2,
          itemCount: 1,
          generalItemCount: 0,
          lastActivityAt: "2026-03-18T08:30:00.000Z",
          isEmpty: false
        },
        {
          spaceId: shelfId,
          totalItemCount: 1,
          itemCount: 0,
          generalItemCount: 1,
          lastActivityAt: "2026-03-17T07:15:00.000Z",
          isEmpty: false
        }
      ]);
    } finally {
      await app.close();
    }
  });

  it("logs manual lookups and returns recent scan activity", async () => {
    const { app, scanLogs } = await createApp();

    try {
      const lookupResponse = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/spaces/lookup/RM01`
      });

      expect(lookupResponse.statusCode).toBe(200);
      expect(scanLogs.at(-1)?.method).toBe("manual_lookup");

      const activityResponse = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/spaces/recent-scans?limit=5`
      });

      expect(activityResponse.statusCode).toBe(200);
      const activityItems = activityResponse.json();
      expect(activityItems.some((entry: { method: string; actor: { displayName: string | null }; space: { id: string; breadcrumb: Array<{ id: string; name: string }> } }) => (
        entry.method === "manual_lookup"
        && entry.actor.displayName === "Casey"
        && entry.space.id === roomId
        && entry.space.breadcrumb[0]?.name === "Workshop"
      ))).toBe(true);
    } finally {
      await app.close();
    }
  });
});
