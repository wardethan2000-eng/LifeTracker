import { createDashboardPinSchema, dashboardPinSchema } from "@aegis/types";
import type { FastifyPluginAsync } from "fastify";

const MAX_PINS = 8;

const entityHref = (entityType: string, entityId: string): string => {
  if (entityType === "project") return `/projects/${entityId}`;
  if (entityType === "hobby") return `/hobbies/${entityId}`;
  return `/assets/${entityId}`;
};

export const dashboardPinRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/dashboard-pins
  app.get("/v1/dashboard-pins", async (request) => {
    const pins = await app.prisma.dashboardPin.findMany({
      where: { userId: request.auth.userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    if (pins.length === 0) return [];

    // Batch-enrich entity names and statuses
    const assetIds = pins.filter((p) => p.entityType === "asset").map((p) => p.entityId);
    const projectIds = pins.filter((p) => p.entityType === "project").map((p) => p.entityId);
    const hobbyIds = pins.filter((p) => p.entityType === "hobby").map((p) => p.entityId);

    const [assets, projects, hobbies] = await Promise.all([
      assetIds.length > 0
        ? app.prisma.asset.findMany({ where: { id: { in: assetIds } }, select: { id: true, name: true } })
        : [],
      projectIds.length > 0
        ? app.prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true, status: true } })
        : [],
      hobbyIds.length > 0
        ? app.prisma.hobby.findMany({ where: { id: { in: hobbyIds } }, select: { id: true, name: true } })
        : [],
    ]);

    const assetMap = new Map(assets.map((a) => [a.id, a]));
    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const hobbyMap = new Map(hobbies.map((h) => [h.id, h]));

    return pins.map((pin) => {
      let name = pin.entityId;
      let status: string | null = null;

      if (pin.entityType === "asset") {
        name = assetMap.get(pin.entityId)?.name ?? pin.entityId;
      } else if (pin.entityType === "project") {
        const proj = projectMap.get(pin.entityId);
        name = proj?.name ?? pin.entityId;
        status = proj?.status ?? null;
      } else if (pin.entityType === "hobby") {
        name = hobbyMap.get(pin.entityId)?.name ?? pin.entityId;
      }

      return dashboardPinSchema.parse({
        id: pin.id,
        entityType: pin.entityType,
        entityId: pin.entityId,
        entityName: name,
        entityStatus: status,
        entityHref: entityHref(pin.entityType, pin.entityId),
        sortOrder: pin.sortOrder,
        createdAt: pin.createdAt.toISOString(),
      });
    });
  });

  // POST /v1/dashboard-pins
  app.post("/v1/dashboard-pins", async (request, reply) => {
    const body = createDashboardPinSchema.parse(request.body);

    const existingCount = await app.prisma.dashboardPin.count({
      where: { userId: request.auth.userId },
    });

    if (existingCount >= MAX_PINS) {
      return reply.code(422).send({ message: `Maximum of ${MAX_PINS} pins allowed. Remove a pin before adding a new one.` });
    }

    const pin = await app.prisma.dashboardPin.upsert({
      where: {
        userId_entityType_entityId: {
          userId: request.auth.userId,
          entityType: body.entityType,
          entityId: body.entityId,
        },
      },
      create: {
        userId: request.auth.userId,
        entityType: body.entityType,
        entityId: body.entityId,
        sortOrder: existingCount,
      },
      update: {},
    });

    return reply.code(201).send({ id: pin.id });
  });

  // DELETE /v1/dashboard-pins/:pinId
  app.delete("/v1/dashboard-pins/:pinId", async (request, reply) => {
    const { pinId } = request.params as { pinId: string };

    const pin = await app.prisma.dashboardPin.findUnique({ where: { id: pinId } });

    if (!pin || pin.userId !== request.auth.userId) {
      return reply.code(404).send({ message: "Pin not found." });
    }

    await app.prisma.dashboardPin.delete({ where: { id: pinId } });

    return reply.code(204).send();
  });
};
