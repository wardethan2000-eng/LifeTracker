import Fastify from "fastify";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authPlugin } from "./plugins/auth.js";
import { destructiveAuditLogPlugin } from "./plugins/destructive-audit-log.js";
import { errorHandlerPlugin } from "./plugins/error-handler.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { resolveApiServerOptions, securityPlugin } from "./plugins/security.js";
import { storagePlugin } from "./plugins/storage.js";
import { assetRoutes } from "./routes/assets/index.js";
import { assetInventoryRoutes } from "./routes/assets/inventory.js";
import { timelineEntryRoutes } from "./routes/assets/timeline-entries.js";
import { timelineRoutes } from "./routes/assets/timeline.js";
import { assetTransferRoutes } from "./routes/assets/transfers.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { healthRoutes } from "./routes/health.js";
import { householdRoutes } from "./routes/households/index.js";
import { householdInventoryAnalyticsRoutes } from "./routes/households/inventory-analytics.js";
import { householdInventoryItemRoutes } from "./routes/households/inventory-items.js";
import { householdInventoryPurchaseRoutes } from "./routes/households/inventory-purchases.js";
import { householdProjectInventoryRollupRoutes } from "./routes/households/project-inventory-rollups.js";
import { householdInventoryTransactionRoutes } from "./routes/households/inventory-transactions.js";
import { householdLinkPreviewRoutes } from "./routes/households/link-preview.js";
import { maintenanceLogRoutes } from "./routes/logs/index.js";
import { maintenanceLogPartRoutes } from "./routes/logs/parts.js";
import { meRoutes } from "./routes/me.js";
import { notificationRoutes } from "./routes/notifications/index.js";
import { presetRoutes } from "./routes/presets/index.js";
import { scheduleRoutes } from "./routes/schedules/index.js";
import { scheduleInventoryRoutes } from "./routes/schedules/inventory.js";
import { serviceProviderRoutes } from "./routes/service-providers/index.js";
import { usageMetricRoutes } from "./routes/usage-metrics/index.js";
import { usageMetricAnalyticsRoutes } from "./routes/usage-metrics/analytics.js";
import { activityLogRoutes } from "./routes/activity-logs/index.js";
import { complianceAnalyticsRoutes } from "./routes/analytics/compliance.js";
import { comparativeAnalyticsRoutes } from "./routes/analytics/comparative.js";
import { commentRoutes } from "./routes/comments/index.js";
import { costAnalyticsRoutes } from "./routes/cost-analytics/index.js";
import { entryRoutes } from "./routes/entries/index.js";
import { exportRoutes } from "./routes/exports/index.js";
import { projectBudgetAnalyticsRoutes } from "./routes/cost-analytics/project-budget.js";
import { invitationRoutes } from "./routes/invitations/index.js";
import { projectRoutes } from "./routes/projects/index.js";
import { projectInventoryRoutes } from "./routes/projects/inventory.js";
import { projectNoteRoutes } from "./routes/projects/notes.js";
import { projectPhaseRoutes } from "./routes/projects/phases.js";
import { searchRoutes } from "./routes/search/index.js";
import scheduleComplianceRoutes from "./routes/schedule-compliance/index.js";
import { attachmentRoutes } from "./routes/attachments/index.js";
import { barcodeRoutes } from "./routes/barcode.js";
import { hobbyRoutes } from "./routes/hobbies/index.js";
import { hobbySeriesRoutes } from "./routes/hobbies/series.js";
import { hobbyRecipeRoutes } from "./routes/hobbies/recipes.js";
import { hobbySessionRoutes } from "./routes/hobbies/sessions.js";
import { hobbyMetricRoutes } from "./routes/hobbies/metrics.js";
import { hobbyLinkRoutes } from "./routes/hobbies/links.js";
import { hobbyProjectRoutes } from "./routes/hobbies/projects.js";
import { hobbyGoalRoutes } from "./routes/hobbies/goals.js";
import { hobbyRoutineRoutes } from "./routes/hobbies/routines.js";
import { hobbyCollectionRoutes } from "./routes/hobbies/collection.js";
import { hobbyShoppingListRoutes } from "./routes/hobbies/shopping-list.js";
import { publicShareRoutes } from "./routes/share-links/public.js";
import { shareLinkRoutes } from "./routes/share-links/index.js";
import { webhookRoutes } from "./routes/webhooks/index.js";

const registerRouteGroup = async (scope: FastifyInstance, plugins: FastifyPluginAsync[]) => {
  for (const plugin of plugins) {
    await scope.register(plugin);
  }
};

const publicRoutePlugins: FastifyPluginAsync[] = [
  publicShareRoutes,
  healthRoutes
];

const accountRoutePlugins: FastifyPluginAsync[] = [
  meRoutes,
  notificationRoutes,
  dashboardRoutes,
  searchRoutes,
  barcodeRoutes
];

const householdRoutePlugins: FastifyPluginAsync[] = [
  householdRoutes,
  householdInventoryAnalyticsRoutes,
  householdInventoryItemRoutes,
  householdInventoryPurchaseRoutes,
  householdProjectInventoryRollupRoutes,
  householdInventoryTransactionRoutes,
  householdLinkPreviewRoutes,
  presetRoutes,
  serviceProviderRoutes,
  activityLogRoutes,
  complianceAnalyticsRoutes,
  comparativeAnalyticsRoutes,
  commentRoutes,
  costAnalyticsRoutes,
  entryRoutes,
  exportRoutes,
  invitationRoutes,
  projectBudgetAnalyticsRoutes,
  webhookRoutes,
  hobbyRoutes,
  hobbySeriesRoutes,
  hobbyRecipeRoutes,
  hobbySessionRoutes,
  hobbyMetricRoutes,
  hobbyLinkRoutes,
  hobbyProjectRoutes,
  hobbyGoalRoutes,
  hobbyRoutineRoutes,
  hobbyCollectionRoutes,
  hobbyShoppingListRoutes
];

const assetRoutePlugins: FastifyPluginAsync[] = [
  assetRoutes,
  assetInventoryRoutes,
  timelineEntryRoutes,
  timelineRoutes,
  assetTransferRoutes,
  usageMetricRoutes,
  usageMetricAnalyticsRoutes,
  scheduleRoutes,
  scheduleInventoryRoutes,
  maintenanceLogRoutes,
  maintenanceLogPartRoutes,
  scheduleComplianceRoutes,
  attachmentRoutes,
  shareLinkRoutes
];

const projectRoutePlugins: FastifyPluginAsync[] = [
  projectRoutes,
  projectInventoryRoutes,
  projectPhaseRoutes,
  projectNoteRoutes
];

export const buildApp = () => {
  const app = Fastify({
    logger: true,
    ...resolveApiServerOptions()
  });
  app.register(securityPlugin);
  app.register(prismaPlugin);
  app.register(async (publicApp) => {
    await registerRouteGroup(publicApp, publicRoutePlugins);
  });
  app.register(authPlugin);
  app.register(destructiveAuditLogPlugin);
  app.register(storagePlugin);
  app.register(errorHandlerPlugin);
  app.register(async (authenticatedApp) => {
    await registerRouteGroup(authenticatedApp, accountRoutePlugins);
    await authenticatedApp.register(async (householdScope) => {
      await registerRouteGroup(householdScope, householdRoutePlugins);
    });
    await authenticatedApp.register(async (assetScope) => {
      await registerRouteGroup(assetScope, assetRoutePlugins);
    });
    await authenticatedApp.register(async (projectScope) => {
      await registerRouteGroup(projectScope, projectRoutePlugins);
    });
  });

  return app;
};
