import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { registerDeviceBodySchema } from "@lifekeeper/types";

const deviceParamsSchema = z.object({
  deviceId: z.string().cuid(),
});

export const deviceRoutes: FastifyPluginAsync = async (app) => {
  // POST /v1/devices/register — register an Expo push token for the current user
  app.post("/v1/devices/register", async (request, reply) => {
    const userId = request.auth.userId;
    const body = registerDeviceBodySchema.parse(request.body);

    // Upsert on token so re-registration is idempotent (e.g. after reinstall)
    const device = await app.prisma.deviceToken.upsert({
      where: { token: body.token },
      update: {
        userId,
        platform: body.platform,
        label: body.label ?? null,
      },
      create: {
        userId,
        token: body.token,
        platform: body.platform,
        label: body.label ?? null,
      },
      select: {
        id: true,
        token: true,
        platform: true,
        label: true,
        createdAt: true,
      },
    });

    return reply.code(201).send({
      id: device.id,
      token: device.token,
      platform: device.platform,
      label: device.label,
      createdAt: device.createdAt.toISOString(),
    });
  }),

  // DELETE /v1/devices/:deviceId — unregister a device token (on sign-out)
    app.delete("/v1/devices/:deviceId", async (request, reply) => {
    const userId = request.auth.userId;
    const { deviceId } = deviceParamsSchema.parse(request.params);

    const existing = await app.prisma.deviceToken.findFirst({
      where: { id: deviceId, userId },
    });

    if (!existing) {
      return reply.code(404).send({ message: "Device token not found." });
    }

    await app.prisma.deviceToken.delete({ where: { id: deviceId } });

    return reply.code(204).send();
  });
};
