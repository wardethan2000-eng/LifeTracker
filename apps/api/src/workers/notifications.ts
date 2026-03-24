import "dotenv/config";
import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { scanComplianceNotifications } from "../lib/compliance-monitor.js";
import { deliverPendingNotification, scanAndCreateNotifications } from "../lib/notifications.js";
import { processDigestBatch } from "../lib/digest.js";
import {
  complianceScanQueueName,
  digestBatchQueueName,
  enqueueNotificationDelivery,
  registerRecurringJobSchedulers,
  notificationDeliveryQueueName,
  notificationScanQueueName,
  type ComplianceScanJobData,
  type NotificationDeliveryJobData,
  type NotificationScanJobData
} from "../lib/queues.js";
import { getRedisConnectionOptions } from "../lib/redis.js";

const prisma = new PrismaClient();
const connection = getRedisConnectionOptions();

const scanWorker = new Worker<NotificationScanJobData>(notificationScanQueueName, async (job) => {
  const result = await scanAndCreateNotifications(prisma, job.data);

  await Promise.all(result.createdNotificationIds.map(async (notificationId) => {
    await enqueueNotificationDelivery({ notificationId });
  }));

  return result;
}, { connection, concurrency: 1 });

const complianceWorker = new Worker<ComplianceScanJobData>(complianceScanQueueName, async (job) => {
  const result = await scanComplianceNotifications(prisma, job.data);

  await Promise.all(result.createdNotificationIds.map(async (notificationId) => {
    await enqueueNotificationDelivery({ notificationId });
  }));

  return result;
}, { connection, concurrency: 1 });

const deliveryWorker = new Worker<NotificationDeliveryJobData>(notificationDeliveryQueueName, async (job) => deliverPendingNotification(prisma, job.data.notificationId), {
  connection,
  concurrency: 5
});

const digestWorker = new Worker(digestBatchQueueName, async () => processDigestBatch(prisma), {
  connection,
  concurrency: 1
});

const shutdown = async () => {
  await Promise.all([
    scanWorker.close(),
    complianceWorker.close(),
    deliveryWorker.close(),
    digestWorker.close()
  ]);
  await prisma.$disconnect();
};

await registerRecurringJobSchedulers();

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});

console.info("Notification workers started with recurring schedulers.");