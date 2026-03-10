import cors from "@fastify/cors";
import Fastify from "fastify";
import { authPlugin } from "./plugins/auth.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { assetRoutes } from "./routes/assets/index.js";
import { healthRoutes } from "./routes/health.js";
import { maintenanceLogRoutes } from "./routes/logs/index.js";
import { presetRoutes } from "./routes/presets/index.js";
import { scheduleRoutes } from "./routes/schedules/index.js";
import { usageMetricRoutes } from "./routes/usage-metrics/index.js";

export const buildApp = () => {
  const app = Fastify({
    logger: true
  });

  app.register(cors, {
    origin: true
  });
  app.register(prismaPlugin);
  app.register(authPlugin);
  app.register(healthRoutes);
  app.register(assetRoutes);
  app.register(usageMetricRoutes);
  app.register(scheduleRoutes);
  app.register(maintenanceLogRoutes);
  app.register(presetRoutes);

  return app;
};
