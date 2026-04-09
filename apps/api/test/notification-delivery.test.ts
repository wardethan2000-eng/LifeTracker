import { describe, expect, it, vi, beforeEach } from "vitest";

// ────────────────────────────────────────────────────────────────────
// Digest batch
// ────────────────────────────────────────────────────────────────────
//
// Note: deliverToAdapter / deliverPendingNotification tests require
// importing notifications.ts which in turn imports @aegis/types.
// @aegis/types has a pre-existing TDZ bug (projectStatusSchema
// used before its declaration at line 747) that prevents those imports
// from loading in the test environment. Those tests are covered by the
// integration test suite instead.
//
// ────────────────────────────────────────────────────────────────────

const sendDigestMock = vi.fn();

vi.mock("../src/lib/adapters/digest-adapter.js", () => ({
  sendDigest: sendDigestMock
}));

const { processDigestBatch } = await import("../src/lib/digest.js");

const makeDbNotification = (userId: string, id: string, email: string | null = "user@example.com") => ({
  id,
  userId,
  title: `Title-${id}`,
  body: `Body-${id}`,
  channel: "digest",
  status: "pending",
  user: { email, displayName: `User-${userId}` }
});

describe("processDigestBatch", () => {
  beforeEach(() => {
    sendDigestMock.mockReset().mockResolvedValue(undefined);
  });

  it("2 users × 3 notifications → 2 sendDigest calls, 6 notifications marked sent", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });

    const notifications = [
      makeDbNotification("user-1", "n-1"),
      makeDbNotification("user-1", "n-2"),
      makeDbNotification("user-1", "n-3"),
      makeDbNotification("user-2", "n-4"),
      makeDbNotification("user-2", "n-5"),
      makeDbNotification("user-2", "n-6")
    ];

    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue(notifications),
        updateMany
      }
    };

    const result = await processDigestBatch(prisma as never);

    expect(result.usersProcessed).toBe(2);
    expect(result.notificationsSent).toBe(6);
    expect(result.notificationsFailed).toBe(0);
    expect(sendDigestMock).toHaveBeenCalledTimes(2);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "sent" }) })
    );
  });

  it("user with no email marks their notifications as failed", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });

    const notifications = [
      makeDbNotification("user-no-email", "n-7", null),
      makeDbNotification("user-no-email", "n-8", null)
    ];

    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue(notifications),
        updateMany
      }
    };

    const result = await processDigestBatch(prisma as never);

    expect(result.notificationsFailed).toBe(2);
    expect(result.notificationsSent).toBe(0);
    expect(sendDigestMock).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "failed" } })
    );
  });

  it("returns zero counts when no pending digest notifications exist", async () => {
    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn()
      }
    };

    const result = await processDigestBatch(prisma as never);

    expect(result.usersProcessed).toBe(0);
    expect(result.notificationsSent).toBe(0);
    expect(result.notificationsFailed).toBe(0);
    expect(sendDigestMock).not.toHaveBeenCalled();
  });
});

