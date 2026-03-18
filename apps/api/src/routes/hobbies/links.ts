import {
  createHobbyAssetInputSchema,
  createHobbyInventoryItemInputSchema,
  createHobbyProjectLinkInputSchema,
  createHobbyInventoryCategoryInputSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { checkMembership } from "../../lib/asset-access.js";
import {
  toHobbyAssetLinkResponse,
  toHobbyInventoryCategoryResponse,
  toHobbyInventoryLinkResponse,
  toHobbyProjectLinkResponse
} from "../../lib/serializers/index.js";
import {
  syncAssetFamilyToSearchIndex,
  syncHobbyToSearchIndex,
  syncInventoryItemToSearchIndex,
  syncProjectToSearchIndex
} from "../../lib/search-index.js";

const hobbyParamsSchema = z.object({
  householdId: z.string().cuid(),
  hobbyId: z.string().cuid()
});

const hobbyAssetParamsSchema = hobbyParamsSchema.extend({
  hobbyAssetId: z.string().cuid()
});

const hobbyInventoryItemParamsSchema = hobbyParamsSchema.extend({
  hobbyInventoryItemId: z.string().cuid()
});

const hobbyProjectParamsSchema = hobbyParamsSchema.extend({
  hobbyProjectId: z.string().cuid()
});

const categoryParamsSchema = hobbyParamsSchema.extend({
  categoryId: z.string().cuid()
});

export const hobbyLinkRoutes: FastifyPluginAsync = async (app) => {
  const BASE = "/v1/households/:householdId/hobbies/:hobbyId/links";

  // ── Asset links ──────────────────────────────

  // GET .../links/assets
  app.get(`${BASE}/assets`, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const links = await app.prisma.hobbyAsset.findMany({
      where: { hobbyId, hobby: { householdId } },
      include: {
        asset: { select: { id: true, name: true, category: true } }
      }
    });

    return reply.send(links.map(toHobbyAssetLinkResponse));
  });

  // POST .../links/assets
  app.post(`${BASE}/assets`, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = createHobbyAssetInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const hobby = await app.prisma.hobby.findFirst({
      where: { id: hobbyId, householdId }
    });
    if (!hobby) {
      return reply.code(404).send({ message: "Hobby not found" });
    }

    const link = await app.prisma.hobbyAsset.create({
      data: {
        hobbyId,
        assetId: input.assetId,
        role: input.role ?? null,
        notes: input.notes ?? null,
      },
      include: {
        asset: { select: { id: true, name: true, category: true } }
      }
    });

    void Promise.all([
      syncHobbyToSearchIndex(app.prisma, hobbyId),
      syncAssetFamilyToSearchIndex(app.prisma, link.assetId)
    ]).catch(console.error);

    return reply.code(201).send(toHobbyAssetLinkResponse(link));
  });

  // DELETE .../links/assets/:hobbyAssetId
  app.delete(`${BASE}/assets/:hobbyAssetId`, async (request, reply) => {
    const { householdId, hobbyId, hobbyAssetId } = hobbyAssetParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbyAsset.findFirst({
      where: { id: hobbyAssetId, hobbyId, hobby: { householdId } }
    });
    if (!existing) {
      return reply.code(404).send({ message: "Asset link not found" });
    }

    await app.prisma.hobbyAsset.delete({ where: { id: hobbyAssetId } });

    void Promise.all([
      syncHobbyToSearchIndex(app.prisma, hobbyId),
      syncAssetFamilyToSearchIndex(app.prisma, existing.assetId)
    ]).catch(console.error);

    return reply.code(204).send();
  });

  // ── Inventory links ──────────────────────────

  // GET .../links/inventory
  app.get(`${BASE}/inventory`, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const links = await app.prisma.hobbyInventoryItem.findMany({
      where: { hobbyId, hobby: { householdId } },
      include: {
        inventoryItem: { select: { id: true, name: true, quantityOnHand: true, unit: true } }
      }
    });

    return reply.send(links.map(toHobbyInventoryLinkResponse));
  });

  // POST .../links/inventory
  app.post(`${BASE}/inventory`, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = createHobbyInventoryItemInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const hobby = await app.prisma.hobby.findFirst({
      where: { id: hobbyId, householdId }
    });
    if (!hobby) {
      return reply.code(404).send({ message: "Hobby not found" });
    }

    const link = await app.prisma.hobbyInventoryItem.create({
      data: {
        hobbyId,
        inventoryItemId: input.inventoryItemId,
        notes: input.notes ?? null,
      },
      include: {
        inventoryItem: { select: { id: true, name: true, quantityOnHand: true, unit: true } }
      }
    });

    void Promise.all([
      syncHobbyToSearchIndex(app.prisma, hobbyId),
      syncInventoryItemToSearchIndex(app.prisma, link.inventoryItemId)
    ]).catch(console.error);

    return reply.code(201).send(toHobbyInventoryLinkResponse(link));
  });

  // DELETE .../links/inventory/:hobbyInventoryItemId
  app.delete(`${BASE}/inventory/:hobbyInventoryItemId`, async (request, reply) => {
    const { householdId, hobbyId, hobbyInventoryItemId } = hobbyInventoryItemParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbyInventoryItem.findFirst({
      where: { id: hobbyInventoryItemId, hobbyId, hobby: { householdId } }
    });
    if (!existing) {
      return reply.code(404).send({ message: "Inventory link not found" });
    }

    await app.prisma.hobbyInventoryItem.delete({ where: { id: hobbyInventoryItemId } });

    void Promise.all([
      syncHobbyToSearchIndex(app.prisma, hobbyId),
      syncInventoryItemToSearchIndex(app.prisma, existing.inventoryItemId)
    ]).catch(console.error);

    return reply.code(204).send();
  });

  // ── Project links ────────────────────────────

  // GET .../links/projects
  app.get(`${BASE}/projects`, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const links = await app.prisma.hobbyProjectLink.findMany({
      where: { hobbyId, hobby: { householdId } },
      include: {
        project: { select: { id: true, name: true, status: true } }
      }
    });

    return reply.send(links.map(toHobbyProjectLinkResponse));
  });

  // POST .../links/projects
  app.post(`${BASE}/projects`, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = createHobbyProjectLinkInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const hobby = await app.prisma.hobby.findFirst({
      where: { id: hobbyId, householdId }
    });
    if (!hobby) {
      return reply.code(404).send({ message: "Hobby not found" });
    }

    const link = await app.prisma.hobbyProjectLink.create({
      data: {
        hobbyId,
        projectId: input.projectId,
        notes: input.notes ?? null,
      },
      include: {
        project: { select: { id: true, name: true, status: true } }
      }
    });

    void Promise.all([
      syncHobbyToSearchIndex(app.prisma, hobbyId),
      syncProjectToSearchIndex(app.prisma, link.projectId)
    ]).catch(console.error);

    return reply.code(201).send(toHobbyProjectLinkResponse(link));
  });

  // DELETE .../links/projects/:hobbyProjectId
  app.delete(`${BASE}/projects/:hobbyProjectId`, async (request, reply) => {
    const { householdId, hobbyId, hobbyProjectId } = hobbyProjectParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbyProjectLink.findFirst({
      where: { id: hobbyProjectId, hobbyId, hobby: { householdId } }
    });
    if (!existing) {
      return reply.code(404).send({ message: "Project link not found" });
    }

    await app.prisma.hobbyProjectLink.delete({ where: { id: hobbyProjectId } });

    void Promise.all([
      syncHobbyToSearchIndex(app.prisma, hobbyId),
      syncProjectToSearchIndex(app.prisma, existing.projectId)
    ]).catch(console.error);

    return reply.code(204).send();
  });

  // ── Inventory categories ─────────────────────

  // GET .../links/inventory-categories
  app.get(`${BASE}/inventory-categories`, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const categories = await app.prisma.hobbyInventoryCategory.findMany({
      where: { hobbyId, hobby: { householdId } },
      orderBy: { sortOrder: "asc" }
    });

    return reply.send(categories.map(toHobbyInventoryCategoryResponse));
  });

  // POST .../links/inventory-categories
  app.post(`${BASE}/inventory-categories`, async (request, reply) => {
    const { householdId, hobbyId } = hobbyParamsSchema.parse(request.params);
    const input = createHobbyInventoryCategoryInputSchema.parse(request.body);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const hobby = await app.prisma.hobby.findFirst({
      where: { id: hobbyId, householdId }
    });
    if (!hobby) {
      return reply.code(404).send({ message: "Hobby not found" });
    }

    const category = await app.prisma.hobbyInventoryCategory.create({
      data: {
        hobbyId,
        categoryName: input.categoryName,
        sortOrder: input.sortOrder ?? null,
      }
    });

    return reply.code(201).send(toHobbyInventoryCategoryResponse(category));
  });

  // DELETE .../links/inventory-categories/:categoryId
  app.delete(`${BASE}/inventory-categories/:categoryId`, async (request, reply) => {
    const { householdId, hobbyId, categoryId } = categoryParamsSchema.parse(request.params);
    const userId = request.auth.userId;

    if (!await checkMembership(app.prisma, householdId, userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.hobbyInventoryCategory.findFirst({
      where: { id: categoryId, hobbyId, hobby: { householdId } }
    });
    if (!existing) {
      return reply.code(404).send({ message: "Category not found" });
    }

    await app.prisma.hobbyInventoryCategory.delete({ where: { id: categoryId } });

    return reply.code(204).send();
  });
};

