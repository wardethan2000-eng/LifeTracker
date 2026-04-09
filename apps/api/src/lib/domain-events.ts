import { createHmac } from "node:crypto";
import type { Prisma, WebhookDeliveryStatus } from "@prisma/client";
import { toInputJsonValue } from "./prisma-json.js";
import type { PrismaExecutor } from "./prisma-types.js";


type EmitDomainEventInput = {
  householdId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
};

const matchesSubscription = (subscribedEventTypes: string[], eventType: string): boolean => (
  subscribedEventTypes.length === 0
  || subscribedEventTypes.includes("*")
  || subscribedEventTypes.includes(eventType)
);

const buildDeliveryPayload = (event: {
  id: string;
  householdId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
}) => JSON.stringify({
  id: event.id,
  householdId: event.householdId,
  eventType: event.eventType,
  entityType: event.entityType,
  entityId: event.entityId,
  payload: event.payload,
  createdAt: event.createdAt.toISOString()
});

const signPayload = (payload: string, secret?: string | null): string | null => {
  if (!secret) {
    return null;
  }

  return createHmac("sha256", secret).update(payload).digest("hex");
};

const toDeliveryStatus = (ok: boolean): WebhookDeliveryStatus => ok ? "delivered" : "failed";

export const dispatchPendingWebhookDeliveries = async (
  prisma: PrismaExecutor,
  options: {
    householdId?: string;
    eventId?: string;
    limit?: number;
  } = {}
): Promise<{ attempted: number; delivered: number; failed: number }> => {
  const deliveries = await prisma.webhookDelivery.findMany({
    where: {
      status: "pending",
      ...(options.eventId ? { domainEventId: options.eventId } : {}),
      ...(options.householdId ? { domainEvent: { householdId: options.householdId } } : {}),
      webhookEndpoint: {
        deletedAt: null,
        isActive: true
      }
    },
    include: {
      webhookEndpoint: true,
      domainEvent: true
    },
    orderBy: { createdAt: "asc" },
    take: options.limit ?? 25
  });

  let delivered = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const payload = buildDeliveryPayload(delivery.domainEvent);
    const signature = signPayload(payload, delivery.webhookEndpoint.secret);

    try {
      const response = await fetch(delivery.webhookEndpoint.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-aegis-event": delivery.domainEvent.eventType,
          "x-aegis-delivery": delivery.id,
          ...(signature ? { "x-aegis-signature": signature } : {})
        },
        body: payload
      });

      const responseBody = await response.text();

      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: toDeliveryStatus(response.ok),
          responseStatus: response.status,
          responseBody: responseBody.slice(0, 4000),
          attemptedAt: new Date()
        }
      });

      if (response.ok) {
        delivered += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "failed",
          responseStatus: null,
          responseBody: error instanceof Error ? error.message.slice(0, 4000) : "Webhook delivery failed.",
          attemptedAt: new Date()
        }
      });

      failed += 1;
    }
  }

  return {
    attempted: deliveries.length,
    delivered,
    failed
  };
};

export const emitDomainEvent = async (
  prisma: PrismaExecutor,
  input: EmitDomainEventInput
): Promise<{ id: string }> => {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      householdId: input.householdId,
      deletedAt: null,
      isActive: true
    },
    select: {
      id: true,
      subscribedEventTypes: true
    }
  });

  const matchingEndpointIds = endpoints
    .filter((endpoint) => matchesSubscription(endpoint.subscribedEventTypes, input.eventType))
    .map((endpoint) => endpoint.id);

  const event = await prisma.domainEvent.create({
    data: {
      householdId: input.householdId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: toInputJsonValue(input.payload ?? {})
    }
  });

  if (matchingEndpointIds.length > 0) {
    await prisma.webhookDelivery.createMany({
      data: matchingEndpointIds.map((webhookEndpointId) => ({
        webhookEndpointId,
        domainEventId: event.id,
        status: "pending"
      }))
    });

    void dispatchPendingWebhookDeliveries(prisma, { eventId: event.id }).catch(console.error);
  }

  return { id: event.id };
};