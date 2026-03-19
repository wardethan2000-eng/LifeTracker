import { beforeEach, describe, expect, it, vi } from "vitest";

const nextMocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn()
}));

const apiMocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  createProjectPhase: vi.fn(),
  createPhaseChecklistItem: vi.fn(),
  createProjectBudgetCategory: vi.fn(),
  createProjectNote: vi.fn(),
  createProjectTask: vi.fn(),
  createTaskChecklistItem: vi.fn(),
  createProjectPhaseSupply: vi.fn(),
  instantiateProjectTemplate: vi.fn(),
  cloneProject: vi.fn(),
  getProjectDetail: vi.fn(),
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
    createProject: apiMocks.createProject,
    createProjectPhase: apiMocks.createProjectPhase,
    createPhaseChecklistItem: apiMocks.createPhaseChecklistItem,
    createProjectBudgetCategory: apiMocks.createProjectBudgetCategory,
    createProjectNote: apiMocks.createProjectNote,
    createProjectTask: apiMocks.createProjectTask,
    createTaskChecklistItem: apiMocks.createTaskChecklistItem,
    createProjectPhaseSupply: apiMocks.createProjectPhaseSupply,
    instantiateProjectTemplate: apiMocks.instantiateProjectTemplate,
    cloneProject: apiMocks.cloneProject,
    getProjectDetail: apiMocks.getProjectDetail,
    createInventoryItem: apiMocks.createInventoryItem,
    completeSchedule: apiMocks.completeSchedule,
    createMaintenanceLog: apiMocks.createMaintenanceLog,
    createSchedule: apiMocks.createSchedule
  };
});

import {
  completeScheduleAction,
  createProjectAction,
  createProjectFromTemplateAction,
  cloneProjectAction,
  createInventoryItemAction,
  createLogAction,
  createScheduleAction
} from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.createInventoryItem.mockResolvedValue({ id: "clinventoryitem0000000001" });
  apiMocks.createProject.mockResolvedValue({ id: "clproject000000000000000001" });
  apiMocks.createProjectPhase.mockImplementation(async (_householdId: string, _projectId: string, input: { name: string }) => ({
    id: `phase-${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  }));
  apiMocks.createProjectTask.mockImplementation(async (_householdId: string, _projectId: string, input: { title: string }) => ({
    id: `task-${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  }));
  apiMocks.instantiateProjectTemplate.mockResolvedValue({ id: "clprojecttemplate000000001" });
  apiMocks.cloneProject.mockResolvedValue({ id: "clprojectclone000000000001" });
  apiMocks.getProjectDetail.mockResolvedValue({ phases: [{ id: "phase-loaded-from-project" }] });
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

  it("seeds wedding blueprint projects with structured planning data", async () => {
    const formData = new FormData();
    formData.set("householdId", "clkeeperhouse000000000001");
    formData.set("name", "Autumn Wedding");
    formData.set("status", "planning");
    formData.set("templateKey", "event-planning-wedding");
    formData.set("targetEndDate", "2026-10-10");

    await createProjectAction(formData);

    expect(apiMocks.createProject).toHaveBeenCalledWith("clkeeperhouse000000000001", expect.objectContaining({
      name: "Autumn Wedding",
      targetEndDate: new Date("2026-10-10").toISOString()
    }));
    expect(apiMocks.createProjectPhase).toHaveBeenCalledTimes(9);
    expect(apiMocks.createPhaseChecklistItem).toHaveBeenCalled();
    expect(apiMocks.createProjectBudgetCategory).toHaveBeenCalledTimes(10);
    expect(apiMocks.createProjectNote).toHaveBeenCalledTimes(5);
    expect(apiMocks.createProjectTask).toHaveBeenCalledTimes(16);
    expect(apiMocks.createTaskChecklistItem).toHaveBeenCalled();
    expect(apiMocks.createProjectPhaseSupply).toHaveBeenCalledTimes(8);
    expect(apiMocks.createProjectPhase).toHaveBeenCalledWith(
      "clkeeperhouse000000000001",
      "clproject000000000000000001",
      expect.objectContaining({
        name: "Vision, Budget & Headcount"
      })
    );
    expect(apiMocks.createProjectTask).toHaveBeenCalledWith(
      "clkeeperhouse000000000001",
      "clproject000000000000000001",
      expect.objectContaining({
        title: "Write the wedding operating brief"
      })
    );
    expect(nextMocks.redirect).toHaveBeenCalledWith(
      "/projects/clproject000000000000000001?householdId=clkeeperhouse000000000001&focusPhaseId=phase-vision-budget-headcount#phase-phase-vision-budget-headcount"
    );
  });

  it("keeps manual blueprints on the lightweight phase-draft path", async () => {
    const formData = new FormData();
    formData.set("householdId", "clkeeperhouse000000000001");
    formData.set("name", "Kitchen Refresh");
    formData.set("status", "planning");
    formData.set("templateKey", "renovation");
    formData.set("suggestedPhasesJson", JSON.stringify(["Planning & Permitting", "Finish Work"]));

    await createProjectAction(formData);

    expect(apiMocks.createProjectPhase).toHaveBeenCalledTimes(2);
    expect(apiMocks.createProjectBudgetCategory).not.toHaveBeenCalled();
    expect(apiMocks.createProjectNote).not.toHaveBeenCalled();
    expect(apiMocks.createProjectTask).not.toHaveBeenCalled();
    expect(apiMocks.createProjectPhaseSupply).not.toHaveBeenCalled();
    expect(nextMocks.redirect).toHaveBeenCalledWith(
      "/projects/clproject000000000000000001?householdId=clkeeperhouse000000000001&focusPhaseId=phase-planning-permitting#phase-phase-planning-permitting"
    );
  });

  it("redirects template-instantiated projects into the first phase workspace", async () => {
    const formData = new FormData();
    formData.set("householdId", "clkeeperhouse000000000001");
    formData.set("templateId", "cltemplate000000000001");
    formData.set("name", "Boathouse Refresh");

    await createProjectFromTemplateAction(formData);

    expect(apiMocks.instantiateProjectTemplate).toHaveBeenCalledWith("clkeeperhouse000000000001", "cltemplate000000000001", {
      name: "Boathouse Refresh"
    });
    expect(apiMocks.getProjectDetail).toHaveBeenCalledWith("clkeeperhouse000000000001", "clprojecttemplate000000001");
    expect(nextMocks.redirect).toHaveBeenCalledWith(
      "/projects/clprojecttemplate000000001?householdId=clkeeperhouse000000000001&focusPhaseId=phase-loaded-from-project#phase-phase-loaded-from-project"
    );
  });

  it("redirects cloned projects into the first phase workspace", async () => {
    const formData = new FormData();
    formData.set("householdId", "clkeeperhouse000000000001");
    formData.set("projectId", "clprojectsource000000001");
    formData.set("name", "Workshop Copy");

    await cloneProjectAction(formData);

    expect(apiMocks.cloneProject).toHaveBeenCalledWith("clkeeperhouse000000000001", "clprojectsource000000001", {
      name: "Workshop Copy"
    });
    expect(apiMocks.getProjectDetail).toHaveBeenCalledWith("clkeeperhouse000000000001", "clprojectclone000000000001");
    expect(nextMocks.redirect).toHaveBeenCalledWith(
      "/projects/clprojectclone000000000001?householdId=clkeeperhouse000000000001&focusPhaseId=phase-loaded-from-project#phase-phase-loaded-from-project"
    );
  });
});