import cors from "@fastify/cors";
import Fastify from "fastify";
import { authPlugin } from "./plugins/auth.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { assetRoutes } from "./routes/assets/index.js";
import { assetInventoryRoutes } from "./routes/assets/inventory.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { healthRoutes } from "./routes/health.js";
import { householdRoutes } from "./routes/households/index.js";
import { householdInventoryItemRoutes } from "./routes/households/inventory-items.js";
import { householdInventoryTransactionRoutes } from "./routes/households/inventory-transactions.js";
import { maintenanceLogRoutes } from "./routes/logs/index.js";
import { maintenanceLogPartRoutes } from "./routes/logs/parts.js";
import { meRoutes } from "./routes/me.js";
import { notificationRoutes } from "./routes/notifications/index.js";
import { presetRoutes } from "./routes/presets/index.js";
import { scheduleRoutes } from "./routes/schedules/index.js";
import { serviceProviderRoutes } from "./routes/service-providers/index.js";
import { usageMetricRoutes } from "./routes/usage-metrics/index.js";
import { activityLogRoutes } from "./routes/activity-logs/index.js";
import { commentRoutes } from "./routes/comments/index.js";
import { invitationRoutes } from "./routes/invitations/index.js";
import { projectRoutes } from "./routes/projects/index.js";
import { projectInventoryRoutes } from "./routes/projects/inventory.js";

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
  app.register(householdInventoryItemRoutes);
  app.register(householdInventoryTransactionRoutes);
  app.register(notificationRoutes);
  app.register(dashboardRoutes);
  app.register(assetRoutes);
  app.register(assetInventoryRoutes);
  app.register(usageMetricRoutes);
  app.register(scheduleRoutes);
  app.register(maintenanceLogRoutes);
  app.register(maintenanceLogPartRoutes);
  app.register(presetRoutes);
  app.register(serviceProviderRoutes);
  app.register(activityLogRoutes);
  app.register(commentRoutes);
  app.register(invitationRoutes);
  app.register(projectRoutes);
  app.register(projectInventoryRoutes);

  return app;
};
