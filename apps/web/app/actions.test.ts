import { beforeEach, describe, expect, it, vi } from "vitest";

const nextMocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn()
}));

const apiMocks = vi.hoisted(() => ({
  createInventoryItem: vi.fn(),
  completeSchedule: vi.fn(),
  createMaintenanceLog: vi.fn(),
  createSchedule: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: nextMocks.revalidatePath
}));

vi.mock("next/navigation", () => ({
  redirect: nextMocks.redirect
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn
  };
});

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();

  return {
    ...actual,
    createInventoryItem: apiMocks.createInventoryItem,
    completeSchedule: apiMocks.completeSchedule,
    createMaintenanceLog: apiMocks.createMaintenanceLog,
    createSchedule: apiMocks.createSchedule
  };
});

import {
  completeScheduleAction,
  createInventoryItemAction,
  createLogAction,
  createScheduleAction
} from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("server actions", () => {
  it("creates inventory items with parsed optional fields and redirects back to inventory", async () => {
    const formData = new FormData();
    formData.set("householdId", "clkeeperhouse000000000001");
    formData.set("name", "Oil Filter");
    formData.set("quantityOnHand", "4");
    formData.set("unit", "each");
    formData.set("itemType", "consumable");
    formData.set("partNumber", "OF-123");
    formData.set("manufacturer", "Acme");
    formData.set("reorderThreshold", "2");
    formData.set("unitCost", "12.5");
    formData.set("supplierUrl", "https://example.com/filter");

    await createInventoryItemAction(formData);

    expect(apiMocks.createInventoryItem).toHaveBeenCalledWith("clkeeperhouse000000000001", {
      name: "Oil Filter",
      quantityOnHand: 4,
      unit: "each",
      itemType: "consumable",
      partNumber: "OF-123",
      manufacturer: "Acme",
      reorderThreshold: 2,
      unitCost: 12.5,
      supplierUrl: "https://example.com/filter"
    });
    expect(nextMocks.revalidatePath).toHaveBeenCalledWith("/inventory");
    expect(nextMocks.redirect).toHaveBeenCalledWith("/inventory?householdId=clkeeperhouse000000000001");
  });

  it("completes schedules with parsed timestamps, numbers, and linked-part opt out", async () => {
    const formData = new FormData();
    formData.set("assetId", "clkeeperasset0000000000001");
    formData.set("scheduleId", "clkeeperschedule000000000001");
    formData.set("title", "Oil change completed");
    formData.set("completedAt", "2026-03-17T10:00:00.000Z");
    formData.set("usageValue", "9500");
    formData.set("cost", "99.99");
    formData.set("applyLinkedParts", "false");

    await completeScheduleAction(formData);

    expect(apiMocks.completeSchedule).toHaveBeenCalledWith("clkeeperasset0000000000001", "clkeeperschedule000000000001", {
      title: "Oil change completed",
      completedAt: "2026-03-17T10:00:00.000Z",
      usageValue: 9500,
      cost: 99.99,
      applyLinkedParts: false,
      metadata: {}
    });
    expect(nextMocks.revalidatePath).toHaveBeenCalledWith("/assets/clkeeperasset0000000000001");
    expect(nextMocks.revalidatePath).toHaveBeenCalledWith("/maintenance");
  });

  it("creates compound schedules with digest notifications and truncated estimated minutes", async () => {
    const formData = new FormData();
    formData.set("assetId", "clkeeperasset0000000000001");
    formData.set("name", "Oil change");
    formData.set("description", "Replace oil and inspect filter");
    formData.set("triggerType", "compound");
    formData.set("metricId", "clkeepermetric0000000000001");
    formData.set("intervalDays", "180");
    formData.set("intervalValue", "5000");
    formData.set("leadTimeDays", "7");
    formData.set("leadTimeValue", "250");
    formData.set("logic", "whichever_last");
    formData.set("estimatedCost", "89.5");
    formData.set("estimatedMinutes", "45.8");
    formData.set("digest", "on");

    await createScheduleAction(formData);

    expect(apiMocks.createSchedule).toHaveBeenCalledWith("clkeeperasset0000000000001", {
      assetId: "clkeeperasset0000000000001",
      name: "Oil change",
      description: "Replace oil and inspect filter",
      metricId: "clkeepermetric0000000000001",
      triggerConfig: {
        type: "compound",
        intervalDays: 180,
        metricId: "clkeepermetric0000000000001",
        intervalValue: 5000,
        logic: "whichever_last",
        leadTimeDays: 7,
        leadTimeValue: 250
      },
      notificationConfig: {
        channels: ["push", "digest"],
        sendAtDue: true,
        digest: true
      },
      estimatedCost: 89.5,
      estimatedMinutes: 45
    });
    expect(nextMocks.revalidatePath).toHaveBeenCalledWith("/assets/clkeeperasset0000000000001");
    expect(nextMocks.revalidatePath).toHaveBeenCalledWith("/maintenance");
  });

  it("creates schedule-linked logs with linked-parts auto-apply enabled by default", async () => {
    const formData = new FormData();
    formData.set("assetId", "clkeeperasset0000000000001");
    formData.set("scheduleId", "clkeeperschedule000000000001");
    formData.set("title", "Oil change completed");
    formData.set("completedAt", "2026-03-17T10:00:00.000Z");
    formData.set("usageValue", "9500");
    formData.set("cost", "99.99");

    await createLogAction(formData);

    expect(apiMocks.createMaintenanceLog).toHaveBeenCalledWith("clkeeperasset0000000000001", {
      scheduleId: "clkeeperschedule000000000001",
      title: "Oil change completed",
      completedAt: "2026-03-17T10:00:00.000Z",
      usageValue: 9500,
      cost: 99.99,
      applyLinkedParts: true,
      metadata: {}
    });
    expect(nextMocks.revalidatePath).toHaveBeenCalledWith("/assets/clkeeperasset0000000000001");
    expect(nextMocks.revalidatePath).toHaveBeenCalledWith("/maintenance");
  });
});