import { Queue } from "bullmq";
import { getRedisConnectionOptions } from "./redis.js";

export interface NotificationScanJobData {
  householdId?: string;
}

export interface ComplianceScanJobData {
  householdId?: string;
}

export interface NotificationDeliveryJobData {
  notificationId: string;
}

export const notificationScanQueueName = "notification-scan";
export const complianceScanQueueName = "compliance-scan";
export const notificationDeliveryQueueName = "notification-delivery";
export const digestBatchQueueName = "digest-batch";
export const recurringNotificationScanSchedulerId = "recurring-notification-scan";
export const recurringComplianceScanSchedulerId = "recurring-compliance-scan";
export const recurringDigestBatchSchedulerId = "recurring-digest-batch";

// When ENABLE_QUEUES=false, all queue operations become no-ops and no Redis
// connections are established. Useful for minimal dev environments.
const areQueuesEnabled = (): boolean => {
  const val = process.env.ENABLE_QUEUES;
  if (val === undefined) return true;
  return val === "true" || val === "1" || val === "yes" || val === "on";
};

let notificationScanQueue: Queue<NotificationScanJobData> | undefined;
let complianceScanQueue: Queue<ComplianceScanJobData> | undefined;
let notificationDeliveryQueue: Queue<NotificationDeliveryJobData> | undefined;
let digestBatchQueue: Queue | undefined;

const createNotificationScanQueue = () => new Queue<NotificationScanJobData>(notificationScanQueueName, {
  connection: getRedisConnectionOptions()
});

const createComplianceScanQueue = () => new Queue<ComplianceScanJobData>(complianceScanQueueName, {
  connection: getRedisConnectionOptions()
});

const createNotificationDeliveryQueue = () => new Queue<NotificationDeliveryJobData>(notificationDeliveryQueueName, {
  connection: getRedisConnectionOptions()
});

const createDigestBatchQueue = () => new Queue(digestBatchQueueName, {
  connection: getRedisConnectionOptions()
});

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return value === "true" || value === "1" || value === "yes" || value === "on";
};

const getNotificationScanCron = (): string => process.env.NOTIFICATION_SCAN_CRON ?? "0 * * * *";

const getComplianceScanCron = (): string => process.env.COMPLIANCE_SCAN_CRON ?? "15 * * * *";

const getDigestBatchCron = (): string => process.env.DIGEST_BATCH_CRON ?? "0 8 * * *";

const areRecurringJobsEnabled = (): boolean => parseBoolean(process.env.ENABLE_RECURRING_JOBS, true);

export const getNotificationScanQueue = (): Queue<NotificationScanJobData> => {
  if (!notificationScanQueue) {
    notificationScanQueue = createNotificationScanQueue();
  }

  return notificationScanQueue;
};

export const getComplianceScanQueue = (): Queue<ComplianceScanJobData> => {
  if (!complianceScanQueue) {
    complianceScanQueue = createComplianceScanQueue();
  }

  return complianceScanQueue;
};

export const getNotificationDeliveryQueue = (): Queue<NotificationDeliveryJobData> => {
  if (!notificationDeliveryQueue) {
    notificationDeliveryQueue = createNotificationDeliveryQueue();
  }

  return notificationDeliveryQueue;
};

export const getDigestBatchQueue = (): Queue => {
  if (!digestBatchQueue) {
    digestBatchQueue = createDigestBatchQueue();
  }

  return digestBatchQueue;
};

export const enqueueNotificationScan = async (data: NotificationScanJobData = {}) => {
  if (!areQueuesEnabled()) return;

  const queue = getNotificationScanQueue();

  return queue.add("scan", data, {
    removeOnComplete: 50,
    removeOnFail: 50
  });
};

export const enqueueComplianceScan = async (data: ComplianceScanJobData = {}) => {
  if (!areQueuesEnabled()) return;

  const queue = getComplianceScanQueue();

  return queue.add("scan", data, {
    removeOnComplete: 50,
    removeOnFail: 50
  });
};

export const enqueueNotificationDelivery = async (data: NotificationDeliveryJobData) => {
  if (!areQueuesEnabled()) return;

  const queue = getNotificationDeliveryQueue();

  return queue.add("deliver", data, {
    jobId: data.notificationId,
    removeOnComplete: 100,
    removeOnFail: 100
  });
};

export const registerRecurringJobSchedulers = async (): Promise<void> => {
  if (!areQueuesEnabled() || !areRecurringJobsEnabled()) {
    return;
  }

  await Promise.all([
    getNotificationScanQueue().upsertJobScheduler(
      recurringNotificationScanSchedulerId,
      { pattern: getNotificationScanCron() },
      {
        name: "scan",
        data: {},
        opts: {
          removeOnComplete: 50,
          removeOnFail: 50
        }
      }
    ),
    getComplianceScanQueue().upsertJobScheduler(
      recurringComplianceScanSchedulerId,
      { pattern: getComplianceScanCron() },
      {
        name: "scan",
        data: {},
        opts: {
          removeOnComplete: 50,
          removeOnFail: 50
        }
      }
    ),
    getDigestBatchQueue().upsertJobScheduler(
      recurringDigestBatchSchedulerId,
      { pattern: getDigestBatchCron() },
      {
        name: "batch",
        data: {},
        opts: {
          removeOnComplete: 50,
          removeOnFail: 50
        }
      }
    )
  ]);
};