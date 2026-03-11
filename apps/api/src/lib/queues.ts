import { Queue } from "bullmq";
import { getRedisConnectionOptions } from "./redis.js";

export interface NotificationScanJobData {
  householdId?: string;
}

export interface NotificationDeliveryJobData {
  notificationId: string;
}

export const notificationScanQueueName = "notification-scan";
export const notificationDeliveryQueueName = "notification-delivery";

let notificationScanQueue: Queue<NotificationScanJobData> | undefined;
let notificationDeliveryQueue: Queue<NotificationDeliveryJobData> | undefined;

const createNotificationScanQueue = () => new Queue<NotificationScanJobData>(notificationScanQueueName, {
  connection: getRedisConnectionOptions()
});

const createNotificationDeliveryQueue = () => new Queue<NotificationDeliveryJobData>(notificationDeliveryQueueName, {
  connection: getRedisConnectionOptions()
});

export const getNotificationScanQueue = (): Queue<NotificationScanJobData> => {
  if (!notificationScanQueue) {
    notificationScanQueue = createNotificationScanQueue();
  }

  return notificationScanQueue;
};

export const getNotificationDeliveryQueue = (): Queue<NotificationDeliveryJobData> => {
  if (!notificationDeliveryQueue) {
    notificationDeliveryQueue = createNotificationDeliveryQueue();
  }

  return notificationDeliveryQueue;
};

export const enqueueNotificationScan = async (data: NotificationScanJobData = {}) => {
  const queue = getNotificationScanQueue();

  return queue.add("scan", data, {
    removeOnComplete: 50,
    removeOnFail: 50
  });
};

export const enqueueNotificationDelivery = async (data: NotificationDeliveryJobData) => {
  const queue = getNotificationDeliveryQueue();

  return queue.add("deliver", data, {
    jobId: data.notificationId,
    removeOnComplete: 100,
    removeOnFail: 100
  });
};