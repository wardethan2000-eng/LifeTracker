import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  assertMembership: vi.fn(async () => undefined),
  querySearchIndex: vi.fn(async () => ({
    query: "garage",
    groups: [{
      entityType: "space",
      label: "Spaces",
      results: [{
        entityType: "space",
        entityId: "clkeeperspace000000000001",
        title: "Garage Shelf",
        subtitle: "A3K7",
        entityUrl: "/inventory/spaces/clkeeperspace000000000001?householdId=clkeeperhouse000000000001",
        parentEntityName: null,
        entityMeta: {
          shortCode: "A3K7"
        }
      }]
    }]
  }))
}));

vi.mock("../src/lib/asset-access.js", () => ({
  assertMembership: routeMocks.assertMembership
}));

vi.mock("../src/lib/search-index.js", () => ({
  querySearchIndex: routeMocks.querySearchIndex
}));

import { searchRoutes } from "../src/routes/search/index.js";

const householdId = "clkeeperhouse000000000001";
const userId = "clkeeperuser0000000000001";

const createApp = async () => {
  const app = Fastify();

  app.decorate("prisma", {} as never);
  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = {
      userId,
      clerkUserId: null,
      source: "dev-bypass"
    };
  });

  await app.register(searchRoutes);

  return app;
};

describe("search routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards include, fuzzy, and includeHistory options to the search index query", async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/search?q=garage&include=space&includeHistory=true&fuzzy=false&limit=10`
      });

      expect(response.statusCode).toBe(200);
      expect(routeMocks.assertMembership).toHaveBeenCalledWith(expect.anything(), householdId, userId);
      expect(routeMocks.querySearchIndex).toHaveBeenCalledWith(expect.anything(), {
        householdId,
        q: "garage",
        limit: 10,
        include: ["space"],
        fuzzy: false,
        includeHistory: true
      });
      expect(response.json()).toMatchObject({
        query: "garage",
        groups: [{
          entityType: "space",
          label: "Spaces"
        }]
      });
    } finally {
      await app.close();
    }
  });

  it("supports the legacy types parameter for include filtering", async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: `/v1/households/${householdId}/search?q=filter&types=inventory_item`
      });

      expect(response.statusCode).toBe(200);
      expect(routeMocks.querySearchIndex).toHaveBeenCalledWith(expect.anything(), {
        householdId,
        q: "filter",
        limit: 20,
        include: ["inventory_item"],
        fuzzy: true,
        includeHistory: false
      });
    } finally {
      await app.close();
    }
  });
});