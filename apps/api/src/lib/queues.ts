import PgBoss from "pg-boss";

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

// When ENABLE_QUEUES=false, all queue operations become no-ops and no
// Postgres job-table connections are established.
const areQueuesEnabled = (): boolean => {
  const val = process.env.ENABLE_QUEUES;
  if (val === undefined) return true;
  return val === "true" || val === "1" || val === "yes" || val === "on";
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value === "true" || value === "1" || value === "yes" || value === "on";
};

const getNotificationScanCron = (): string => process.env.NOTIFICATION_SCAN_CRON ?? "0 * * * *";
const getComplianceScanCron = (): string => process.env.COMPLIANCE_SCAN_CRON ?? "15 * * * *";
const getDigestBatchCron = (): string => process.env.DIGEST_BATCH_CRON ?? "0 8 * * *";
const areRecurringJobsEnabled = (): boolean => parseBoolean(process.env.ENABLE_RECURRING_JOBS, true);

// Lazily-created singleton. Workers and the main server share this instance.
let boss: PgBoss | undefined;

export const getBoss = (): PgBoss => {
  if (!boss) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL is required for pg-boss.");
    boss = new PgBoss(dbUrl);
  }
  return boss;
};

// Start the pg-boss instance (idempotent — safe to call multiple times).
export const startBoss = async (): Promise<PgBoss> => {
  const b = getBoss();
  await b.start();
  return b;
};

export const enqueueNotificationScan = async (data: NotificationScanJobData = {}): Promise<void> => {
  if (!areQueuesEnabled()) return;
  await getBoss().send(notificationScanQueueName, data);
};

export const enqueueComplianceScan = async (data: ComplianceScanJobData = {}): Promise<void> => {
  if (!areQueuesEnabled()) return;
  await getBoss().send(complianceScanQueueName, data);
};

export const enqueueNotificationDelivery = async (data: NotificationDeliveryJobData): Promise<void> => {
  if (!areQueuesEnabled()) return;
  // Use the notification ID as the job ID so duplicate deliveries are deduplicated.
  await getBoss().send(notificationDeliveryQueueName, data, { id: data.notificationId });
};

export const registerRecurringJobSchedulers = async (): Promise<void> => {
  if (!areQueuesEnabled() || !areRecurringJobsEnabled()) return;

  await Promise.all([
    getBoss().schedule(notificationScanQueueName, getNotificationScanCron()),
    getBoss().schedule(complianceScanQueueName, getComplianceScanCron()),
    getBoss().schedule(digestBatchQueueName, getDigestBatchCron()),
  ]);
};
