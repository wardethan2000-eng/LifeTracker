import {
  createWebhookEndpointSchema,
  domainEventSchema,
  updateWebhookEndpointSchema,
  webhookDeliverySchema,
  webhookEndpointSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { dispatchPendingWebhookDeliveries } from "../../lib/domain-events.js";
import { requireHouseholdMembership } from "../../lib/asset-access.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const webhookParamsSchema = householdParamsSchema.extend({
  webhookId: z.string().cuid()
});

const listEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

const listDeliveriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(["pending", "delivered", "failed"]).optional()
});

const dispatchQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/households/:householdId/webhooks", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const endpoints = await app.prisma.webhookEndpoint.findMany({
      where: { householdId: params.householdId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });

    return endpoints.map((endpoint) => webhookEndpointSchema.parse({
      ...endpoint,
      secret: endpoint.secret ?? null,
      deletedAt: endpoint.deletedAt?.toISOString() ?? null,
      createdAt: endpoint.createdAt.toISOString(),
      updatedAt: endpoint.updatedAt.toISOString()
    }));
  });

  app.post("/v1/households/:householdId/webhooks", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = createWebhookEndpointSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const endpoint = await app.prisma.webhookEndpoint.create({
      data: {
        householdId: params.householdId,
        label: input.label,
        url: input.url,
        secret: input.secret ?? null,
        subscribedEventTypes: input.subscribedEventTypes,
        isActive: input.isActive
      }
    });

    return reply.code(201).send(webhookEndpointSchema.parse({
      ...endpoint,
      secret: endpoint.secret ?? null,
      deletedAt: endpoint.deletedAt?.toISOString() ?? null,
      createdAt: endpoint.createdAt.toISOString(),
      updatedAt: endpoint.updatedAt.toISOString()
    }));
  });

  app.patch("/v1/households/:householdId/webhooks/:webhookId", async (request, reply) => {
    const params = webhookParamsSchema.parse(request.params);
    const input = updateWebhookEndpointSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const existing = await app.prisma.webhookEndpoint.findFirst({
      where: { id: params.webhookId, householdId: params.householdId, deletedAt: null }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Webhook endpoint not found." });
    }

    const endpoint = await app.prisma.webhookEndpoint.update({
      where: { id: existing.id },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.secret !== undefined ? { secret: input.secret ?? null } : {}),
        ...(input.subscribedEventTypes !== undefined ? { subscribedEventTypes: input.subscribedEventTypes } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
      }
    });

    return webhookEndpointSchema.parse({
      ...endpoint,
      secret: endpoint.secret ?? null,
      deletedAt: endpoint.deletedAt?.toISOString() ?? null,
      createdAt: endpoint.createdAt.toISOString(),
      updatedAt: endpoint.updatedAt.toISOString()
    });
  });

  app.delete("/v1/households/:householdId/webhooks/:webhookId", async (request, reply) => {
    const params = webhookParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const existing = await app.prisma.webhookEndpoint.findFirst({
      where: { id: params.webhookId, householdId: params.householdId, deletedAt: null }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Webhook endpoint not found." });
    }

    await app.prisma.webhookEndpoint.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), isActive: false }
    });

    return reply.code(204).send();
  });

  app.get("/v1/households/:householdId/events", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = listEventsQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const events = await app.prisma.domainEvent.findMany({
      where: { householdId: params.householdId },
      orderBy: { createdAt: "desc" },
      take: query.limit
    });

    return events.map((event) => domainEventSchema.parse({
      ...event,
      payload: event.payload as Record<string, unknown>,
      createdAt: event.createdAt.toISOString()
    }));
  });

  app.get("/v1/households/:householdId/webhook-deliveries", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = listDeliveriesQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const deliveries = await app.prisma.webhookDelivery.findMany({
      where: {
        domainEvent: { householdId: params.householdId },
        ...(query.status ? { status: query.status } : {})
      },
      orderBy: { createdAt: "desc" },
      take: query.limit
    });

    return deliveries.map((delivery) => webhookDeliverySchema.parse({
      ...delivery,
      responseStatus: delivery.responseStatus ?? null,
      responseBody: delivery.responseBody ?? null,
      attemptedAt: delivery.attemptedAt?.toISOString() ?? null,
      createdAt: delivery.createdAt.toISOString(),
      updatedAt: delivery.updatedAt.toISOString()
    }));
  });

  app.post("/v1/households/:householdId/webhooks/dispatch", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = dispatchQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const result = await dispatchPendingWebhookDeliveries(app.prisma, {
      householdId: params.householdId,
      limit: query.limit
    });

    return result;
  });
};