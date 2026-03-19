import { saveLayoutPreferenceSchema, layoutPreferenceSchema } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";

export const layoutPreferenceRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/layout-preferences?entityType=project&entityId=optional
  app.get("/v1/layout-preferences", async (request, reply) => {
    const { entityType, entityId } = request.query as {
      entityType?: string;
      entityId?: string;
    };

    if (!entityType) {
      return reply.code(400).send({ message: "entityType query parameter is required." });
    }

    const pref = await app.prisma.userLayoutPreference.findUnique({
      where: {
        userId_entityType_entityId: {
          userId: request.auth.userId,
          entityType,
          entityId: entityId ?? "",
        },
      },
    });

    if (!pref) {
      return reply.code(200).send(null);
    }

    return layoutPreferenceSchema.parse({
      id: pref.id,
      entityType: pref.entityType,
      entityId: pref.entityId,
      layoutJson: pref.layoutJson,
      createdAt: pref.createdAt.toISOString(),
      updatedAt: pref.updatedAt.toISOString(),
    });
  });

  // PUT /v1/layout-preferences
  app.put("/v1/layout-preferences", async (request) => {
    const body = saveLayoutPreferenceSchema.parse(request.body);

    const pref = await app.prisma.userLayoutPreference.upsert({
      where: {
        userId_entityType_entityId: {
          userId: request.auth.userId,
          entityType: body.entityType,
          entityId: body.entityId ?? "",
        },
      },
      create: {
        userId: request.auth.userId,
        entityType: body.entityType,
        entityId: body.entityId ?? null,
        layoutJson: body.layoutJson as Prisma.InputJsonValue,
      },
      update: {
        layoutJson: body.layoutJson as Prisma.InputJsonValue,
      },
    });

    return layoutPreferenceSchema.parse({
      id: pref.id,
      entityType: pref.entityType,
      entityId: pref.entityId,
      layoutJson: pref.layoutJson,
      createdAt: pref.createdAt.toISOString(),
      updatedAt: pref.updatedAt.toISOString(),
    });
  });
};
