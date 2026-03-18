import { describe, expect, it, vi } from "vitest";
import { scanAndCreateNotifications } from "../src/lib/notifications.js";

const householdId = "clkeeperhouse000000000001";

describe("project notifications", () => {
  it("creates project due-soon and over-budget notifications during scans", async () => {
    const createMock = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: `${String(data.type)}-${String(data.title)}`,
      ...data
    }));

    const result = await scanAndCreateNotifications({
      maintenanceSchedule: {
        findMany: async () => []
      },
      inventoryItem: {
        findMany: async () => []
      },
      project: {
        findMany: async () => ([
          {
            id: "clkeeperproject0000000001",
            name: "Kitchen Remodel",
            householdId,
            status: "active",
            targetEndDate: new Date("2026-03-20T00:00:00.000Z"),
            budgetAmount: 1000,
            expenses: [{ amount: 1200 }],
            household: {
              members: [
                {
                  userId: "clkeeperuser0000000000001",
                  user: {
                    id: "clkeeperuser0000000000001",
                    notificationPreferences: {
                      enabledChannels: ["push"],
                      pauseAll: false,
                      preferDigest: false
                    }
                  }
                }
              ]
            }
          }
        ])
      },
      notification: {
        create: createMock,
        findFirst: async () => null
      }
    } as never, {
      householdId,
      now: new Date("2026-03-17T00:00:00.000Z")
    });

    expect(result.createdCount).toBe(2);
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: "due_soon",
        title: "Kitchen Remodel is approaching its target date"
      })
    }));
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: "announcement",
        title: "Kitchen Remodel is over budget"
      })
    }));
  });

  it("creates overdue project notifications with project payload links", async () => {
    const createMock = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: `${String(data.type)}-1`,
      ...data
    }));

    await scanAndCreateNotifications({
      maintenanceSchedule: {
        findMany: async () => []
      },
      inventoryItem: {
        findMany: async () => []
      },
      project: {
        findMany: async () => ([
          {
            id: "clkeeperproject0000000002",
            name: "Deck Rebuild",
            householdId,
            status: "active",
            targetEndDate: new Date("2026-03-10T00:00:00.000Z"),
            budgetAmount: 2000,
            expenses: [{ amount: 750 }],
            household: {
              members: [
                {
                  userId: "clkeeperuser0000000000001",
                  user: {
                    id: "clkeeperuser0000000000001",
                    notificationPreferences: {
                      enabledChannels: ["push"],
                      pauseAll: false,
                      preferDigest: false
                    }
                  }
                }
              ]
            }
          }
        ])
      },
      notification: {
        create: createMock,
        findFirst: async () => null
      }
    } as never, {
      householdId,
      now: new Date("2026-03-18T00:00:00.000Z")
    });

    const overdueCall = createMock.mock.calls.find((call) => call[0].data.type === "overdue");
    expect(overdueCall).toBeTruthy();
    expect(overdueCall?.[0].data.payload).toMatchObject({
      entityType: "project",
      entityId: "clkeeperproject0000000002",
      notificationContext: "project_target_date"
    });
  });
});