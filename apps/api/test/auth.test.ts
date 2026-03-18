import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { authPlugin } from "../src/plugins/auth.js";
import { meRoutes } from "../src/routes/me.js";

const originalEnv = { ...process.env };

const userRecord = {
  id: "clkeeperuser0000000000001",
  clerkUserId: "user_clerk_123",
  email: "dev@example.com",
  displayName: "Dev User",
  notificationPreferences: {
    pauseAll: false,
    enabledChannels: ["push"],
    preferDigest: false
  },
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z")
};

const createApp = async () => {
  const app = Fastify();

  app.decorate("prisma", {
    user: {
      findFirst: async ({ where }: { where: { OR: Array<Record<string, string>> } }) => {
        const values = where.OR.flatMap(Object.values);
        return values.includes(userRecord.id) ? userRecord : null;
      },
      findUnique: async ({ where }: { where: { id: string } }) => (
        where.id === userRecord.id ? userRecord : null
      )
    },
    householdMember: {
      findMany: async () => [
        {
          role: "owner",
          joinedAt: new Date("2026-03-01T00:00:00.000Z"),
          household: {
            id: "clkeeperhouse000000000001",
            name: "Primary Household",
            createdById: userRecord.id,
            createdAt: new Date("2026-03-01T00:00:00.000Z"),
            updatedAt: new Date("2026-03-01T00:00:00.000Z"),
            _count: {
              members: 1
            }
          }
        }
      ]
    }
  } as never);

  await app.register(authPlugin);
  await app.register(meRoutes);
  return app;
};

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("auth route integration", () => {
  it("authenticates /v1/me through the development bypass header", async () => {
    process.env.AUTH_MODE = "hybrid";
    process.env.ALLOW_DEV_AUTH_BYPASS = "true";

    const app = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/me",
        headers: {
          "x-dev-user-id": userRecord.id
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        user: {
          id: userRecord.id,
          email: userRecord.email,
          displayName: userRecord.displayName
        },
        auth: {
          source: "dev-bypass",
          clerkUserId: userRecord.clerkUserId
        }
      });
    } finally {
      await app.close();
    }
  });

  it("rejects /v1/me when the development bypass user cannot be resolved", async () => {
    process.env.AUTH_MODE = "dev-bypass";
    process.env.ALLOW_DEV_AUTH_BYPASS = "true";

    const app = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/me",
        headers: {
          "x-dev-user-id": "clkeeperusermissing000001"
        }
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toContain("was not found");
    } finally {
      await app.close();
    }
  });
});