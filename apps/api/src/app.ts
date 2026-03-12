import cors from "@fastify/cors";
import Fastify from "fastify";
import { authPlugin } from "./plugins/auth.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { assetRoutes } from "./routes/assets/index.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { healthRoutes } from "./routes/health.js";
import { householdRoutes } from "./routes/households/index.js";
import { maintenanceLogRoutes } from "./routes/logs/index.js";
import { meRoutes } from "./routes/me.js";
import { notificationRoutes } from "./routes/notifications/index.js";
import { presetRoutes } from "./routes/presets/index.js";
import { scheduleRoutes } from "./routes/schedules/index.js";
import { serviceProviderRoutes } from "./routes/service-providers/index.js";
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
  app.register(meRoutes);
  app.register(householdRoutes);
  app.register(notificationRoutes);
  app.register(dashboardRoutes);
  app.register(assetRoutes);
  app.register(usageMetricRoutes);
  app.register(scheduleRoutes);
  app.register(maintenanceLogRoutes);
  app.register(presetRoutes);
  app.register(serviceProviderRoutes);

  return app;
};
