import "dotenv/config";
import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { deliverPendingNotification, scanAndCreateNotifications } from "../lib/notifications.js";
import {
  enqueueNotificationDelivery,
  notificationDeliveryQueueName,
  notificationScanQueueName,
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

const deliveryWorker = new Worker<NotificationDeliveryJobData>(notificationDeliveryQueueName, async (job) => deliverPendingNotification(prisma, job.data.notificationId), {
  connection,
  concurrency: 5
});

const shutdown = async () => {
  await Promise.all([
    scanWorker.close(),
    deliveryWorker.close()
  ]);
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

console.info("Notification workers started.");