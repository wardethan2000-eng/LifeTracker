import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { scanRoutes } from "../src/routes/scan.js";

const createApp = async () => {
  const app = Fastify();

  app.decorate("prisma", {
    asset: {
      findFirst: async ({ where }: { where: { assetTag?: string } }) => {
        if (where.assetTag === "LK-ASSETTAG01") {
          return { id: "clkeeperasset0000000000001", name: "Generator" };
        }

        return null;
      }
    },
    space: {
      findFirst: async ({ where }: { where: { scanTag?: string } }) => {
        if (where.scanTag === "sp_TESTSPACE01") {
          return { id: "clkeeperspace000000000001", name: "Garage Shelf", shortCode: "A3K7" };
        }

        return null;
      }
    },
    inventoryItem: {
      findFirst: async ({ where }: { where: { scanTag?: string } }) => {
        if (where.scanTag === "inv_TESTITEM01") {
          return {
            id: "clkeeperitem0000000000001",
            name: "Oil Filter",
            scanTag: "inv_TESTITEM01",
            partNumber: "OF-123"
          };
        }

        return null;
      }
    }
  } as never);

  await app.register(scanRoutes);

  return app;
};

describe("scan routes", () => {
  it("resolves asset scan tags publicly", async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/scan/resolve?tag=LK-ASSETTAG01"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        type: "asset",
        id: "clkeeperasset0000000000001",
        name: "Generator",
        url: "/assets/clkeeperasset0000000000001"
      });
    } finally {
      await app.close();
    }
  });

  it("resolves space and inventory scan tags publicly", async () => {
    const app = await createApp();

    try {
      const spaceResponse = await app.inject({
        method: "GET",
        url: "/v1/scan/resolve?tag=sp_TESTSPACE01"
      });
      const inventoryResponse = await app.inject({
        method: "GET",
        url: "/v1/scan/resolve?tag=inv_TESTITEM01"
      });

      expect(spaceResponse.statusCode).toBe(200);
      expect(spaceResponse.json()).toEqual({
        type: "space",
        id: "clkeeperspace000000000001",
        name: "Garage Shelf",
        shortCode: "A3K7",
        url: "/inventory/spaces/clkeeperspace000000000001"
      });

      expect(inventoryResponse.statusCode).toBe(200);
      expect(inventoryResponse.json()).toEqual({
        type: "inventory_item",
        id: "clkeeperitem0000000000001",
        name: "Oil Filter",
        scanTag: "inv_TESTITEM01",
        partNumber: "OF-123",
        url: "/inventory/clkeeperitem0000000000001"
      });
    } finally {
      await app.close();
    }
  });

  it("returns 404 when a scan tag is not found", async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/scan/resolve?tag=missing"
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ message: "Scan tag not found." });
    } finally {
      await app.close();
    }
  });
});