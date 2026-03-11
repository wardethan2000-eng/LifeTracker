import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { deliverPendingNotification, scanAndCreateNotifications } from "../lib/notifications.js";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const householdId = process.argv[2];
  const result = await scanAndCreateNotifications(prisma, householdId ? { householdId } : {});

  for (const notificationId of result.createdNotificationIds) {
    await deliverPendingNotification(prisma, notificationId);
  }

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });