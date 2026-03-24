import type { PrismaClient } from "@prisma/client";
import { sendDigest } from "./adapters/digest-adapter.js";

export interface DigestBatchResult {
  usersProcessed: number;
  notificationsSent: number;
  notificationsFailed: number;
}

export const processDigestBatch = async (prisma: PrismaClient): Promise<DigestBatchResult> => {
  const pending = await prisma.notification.findMany({
    where: {
      channel: "digest",
      status: "pending"
    },
    include: {
      user: {
        select: { email: true, displayName: true }
      }
    }
  });

  if (pending.length === 0) {
    return { usersProcessed: 0, notificationsSent: 0, notificationsFailed: 0 };
  }

  // Group by userId
  const byUser = new Map<string, typeof pending>();
  for (const n of pending) {
    const existing = byUser.get(n.userId) ?? [];
    existing.push(n);
    byUser.set(n.userId, existing);
  }

  let notificationsSent = 0;
  let notificationsFailed = 0;

  await Promise.all(
    Array.from(byUser.entries()).map(async ([userId, notifications]) => {
      const first = notifications.find(() => true);
      const user = first?.user;
      const email = user?.email;

      if (!email) {
        // No email address — mark all as failed
        await prisma.notification.updateMany({
          where: {
            id: { in: notifications.map((n) => n.id) }
          },
          data: { status: "failed" }
        });
        notificationsFailed += notifications.length;
        return;
      }

      try {
        await sendDigest({
          to: email,
          userName: user?.displayName ?? userId,
          entries: notifications.map((n) => ({ title: n.title, body: n.body }))
        });

        await prisma.notification.updateMany({
          where: { id: { in: notifications.map((n) => n.id) } },
          data: { status: "sent", sentAt: new Date() }
        });
        notificationsSent += notifications.length;
      } catch {
        await prisma.notification.updateMany({
          where: { id: { in: notifications.map((n) => n.id) } },
          data: { status: "failed" }
        });
        notificationsFailed += notifications.length;
      }
    })
  );

  return {
    usersProcessed: byUser.size,
    notificationsSent,
    notificationsFailed
  };
};
