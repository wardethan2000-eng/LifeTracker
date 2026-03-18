import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { householdSpaceRoutes } from "../src/routes/households/spaces.js";

const householdId = "clkeeperhouse000000000001";
const spaceId = "clkeeperspace000000000001";
const userId = "clkeeperuser0000000000001";

const createSpaceRecord = (overrides: Partial<{
  id: string;
  householdId: string;
  shortCode: string;
  scanTag: string | null;
  name: string;
  type: "room";
  parentSpaceId: string | null;
  description: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}> = {}) => ({
  id: spaceId,
  householdId,
  shortCode: "A3K7",
  scanTag: null,
  name: "Red Tub",
  type: "room" as const,
  parentSpaceId: null,
  description: null,
  notes: null,
  sortOrder: 0,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  deletedAt: null,
  ...overrides
});

const createApp = async () => {
  let space = createSpaceRecord();
  const app = Fastify();

  app.decorate("prisma", {
    householdMember: {
      findUnique: async () => ({ householdId, userId, role: "owner" })
    },
    space: {
      findFirst: async ({ where }: { where: { id?: string; householdId?: string } }) => {
        if (where.id && where.id !== space.id) {
          return null;
        }

        if (where.householdId && where.householdId !== space.householdId) {
          return null;
        }

        return space;
      },
      findMany: async ({ where }: { where: { id?: { in: string[] }; householdId?: string } }) => {
        if (where.householdId && where.householdId !== householdId) {
          return [];
        }

        if (where.id?.in && !where.id.in.includes(space.id)) {
          return [];
        }

        return [space];
      },
      findUnique: async ({ where, select }: { where: { id?: string; scanTag?: string }; select?: Record<string, boolean> }) => {
        if ((where.id && where.id !== space.id) || (where.scanTag && where.scanTag !== space.scanTag)) {
          return null;
        }

        if (select?.scanTag) {
          return { id: space.id, scanTag: space.scanTag };
        }

        return {
          id: space.id,
          name: space.name,
          type: space.type,
          parentSpaceId: space.parentSpaceId
        };
      },
      update: async ({ where, data }: { where: { id: string }; data: { scanTag?: string } }) => {
        if (where.id !== space.id) {
          throw new Error("Space not found.");
        }

        space = createSpaceRecord({ ...space, scanTag: data.scanTag ?? space.scanTag });
        return space;
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

  await app.register(householdSpaceRoutes);

  return app;
};

describe("household space routes", () => {
  it("returns an SVG QR code and generates a missing scan tag", async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/spaces/${spaceId}/qr?format=svg&size=240`
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("image/svg+xml");
      expect(response.body).toContain("<svg");
    } finally {
      await app.close();
    }
  });

  it("returns a PDF for batch space labels", async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/spaces/labels/batch`,
        payload: {
          spaceIds: [spaceId]
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/pdf");
      expect(response.body.slice(0, 4)).toBe("%PDF");
    } finally {
      await app.close();
    }
  });
});