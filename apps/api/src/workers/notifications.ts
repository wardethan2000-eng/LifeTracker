import "dotenv/config";

const areQueuesEnabled = (): boolean => {
  const val = process.env.ENABLE_QUEUES;
  if (val === undefined) return true;
  return val === "true" || val === "1" || val === "yes" || val === "on";
};

if (!areQueuesEnabled()) {
  console.info("ENABLE_QUEUES=false — notification workers are disabled.");
  process.exit(0);
}

import { PrismaClient } from "@prisma/client";
import { scanComplianceNotifications } from "../lib/compliance-monitor.js";
import { deliverPendingNotification, scanAndCreateNotifications } from "../lib/notifications.js";
import { processDigestBatch } from "../lib/digest.js";
import {
  complianceScanQueueName,
  digestBatchQueueName,
  enqueueNotificationDelivery,
  notificationDeliveryQueueName,
  notificationScanQueueName,
  registerRecurringJobSchedulers,
  startBoss,
  type ComplianceScanJobData,
  type NotificationDeliveryJobData,
  type NotificationScanJobData,
} from "../lib/queues.js";

const prisma = new PrismaClient();
const boss = await startBoss();

await boss.work<NotificationScanJobData>(notificationScanQueueName, { teamSize: 1 }, async (job) => {
  const result = await scanAndCreateNotifications(prisma, job.data);

  await Promise.all(result.createdNotificationIds.map(async (notificationId) => {
    await enqueueNotificationDelivery({ notificationId });
  }));

  return result;
});

await boss.work<ComplianceScanJobData>(complianceScanQueueName, { teamSize: 1 }, async (job) => {
  const result = await scanComplianceNotifications(prisma, job.data);

  await Promise.all(result.createdNotificationIds.map(async (notificationId) => {
    await enqueueNotificationDelivery({ notificationId });
  }));

  return result;
});

await boss.work<NotificationDeliveryJobData>(
  notificationDeliveryQueueName,
  { teamSize: 5 },
  async (job) => deliverPendingNotification(prisma, job.data.notificationId)
);

await boss.work(digestBatchQueueName, { teamSize: 1 }, async () => processDigestBatch(prisma));

await registerRecurringJobSchedulers();

const shutdown = async () => {
  await boss.stop();
  await prisma.$disconnect();
};

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});

console.info("Notification workers started (pg-boss) with recurring schedulers.");
