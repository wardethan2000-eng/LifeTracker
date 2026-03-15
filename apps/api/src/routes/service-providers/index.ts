import type { Prisma } from "@prisma/client";
import {
  createServiceProviderSchema,
  updateServiceProviderSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership } from "../../lib/asset-access.js";
import { toServiceProviderResponse } from "../../lib/serializers/index.js";
import { logActivity } from "../../lib/activity-log.js";
import { syncServiceProviderToSearchIndex, removeSearchIndexEntry } from "../../lib/search-index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const providerParamsSchema = householdParamsSchema.extend({
  providerId: z.string().cuid()
});

const listProvidersQuerySchema = z.object({
  specialty: z.string().max(120).optional()
});

export const serviceProviderRoutes: FastifyPluginAsync = async (app) => {
  app.post("/v1/households/:householdId/service-providers", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = createServiceProviderSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const provider = await app.prisma.serviceProvider.create({
      data: {
        householdId: params.householdId,
        name: input.name,
        specialty: input.specialty ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        website: input.website ?? null,
        address: input.address ?? null,
        rating: input.rating ?? null,
        notes: input.notes ?? null
      }
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "service_provider.created",
      entityType: "service_provider",
      entityId: provider.id,
      metadata: { name: provider.name }
    });

    void syncServiceProviderToSearchIndex(app.prisma, provider.id).catch(console.error);

    return reply.code(201).send(toServiceProviderResponse(provider));
  });

  app.get("/v1/households/:householdId/service-providers", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = listProvidersQuerySchema.parse(request.query);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const where: Prisma.ServiceProviderWhereInput = {
      householdId: params.householdId,
      ...(query.specialty ? { specialty: { contains: query.specialty, mode: "insensitive" as const } } : {})
    };

    const providers = await app.prisma.serviceProvider.findMany({
      where,
      orderBy: { name: "asc" }
    });

    return providers.map(toServiceProviderResponse);
  });

  app.get("/v1/households/:householdId/service-providers/:providerId", async (request, reply) => {
    const params = providerParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const provider = await app.prisma.serviceProvider.findFirst({
      where: { id: params.providerId, householdId: params.householdId }
    });

    if (!provider) {
      return reply.code(404).send({ message: "Service provider not found." });
    }

    return toServiceProviderResponse(provider);
  });

  app.patch("/v1/households/:householdId/service-providers/:providerId", async (request, reply) => {
    const params = providerParamsSchema.parse(request.params);
    const input = updateServiceProviderSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.serviceProvider.findFirst({
      where: { id: params.providerId, householdId: params.householdId }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Service provider not found." });
    }

    const data: Prisma.ServiceProviderUncheckedUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.specialty !== undefined) data.specialty = input.specialty;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.email !== undefined) data.email = input.email;
    if (input.website !== undefined) data.website = input.website;
    if (input.address !== undefined) data.address = input.address;
    if (input.rating !== undefined) data.rating = input.rating;
    if (input.notes !== undefined) data.notes = input.notes;

    const provider = await app.prisma.serviceProvider.update({
      where: { id: existing.id },
      data
    });

    void syncServiceProviderToSearchIndex(app.prisma, provider.id).catch(console.error);

    return toServiceProviderResponse(provider);
  });

  app.delete("/v1/households/:householdId/service-providers/:providerId", async (request, reply) => {
    const params = providerParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.serviceProvider.findFirst({
      where: { id: params.providerId, householdId: params.householdId }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Service provider not found." });
    }

    // Prisma onDelete: SetNull handles clearing serviceProviderId on related logs
    await app.prisma.serviceProvider.delete({ where: { id: existing.id } });

    void removeSearchIndexEntry(app.prisma, "service_provider", existing.id).catch(console.error);

    return reply.code(204).send();
  });
};
