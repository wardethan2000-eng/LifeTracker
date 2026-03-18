import { describe, expect, it } from "vitest";
import { buildProjectTemplateSnapshot, summarizeProjectTemplateSnapshot } from "../src/lib/project-templates.js";
import { assertTaskDependenciesAcyclic, buildProjectTaskGraphSummary } from "../src/lib/project-task-graph.js";
import {
  buildPhaseCompletionGuardrailMessage,
  buildProjectCompletionGuardrailMessage,
  getPhaseCompletionSummary,
  getProjectCompletionSummary,
  syncProjectDerivedStatuses
} from "../src/lib/project-status.js";

describe("project task graph", () => {
  it("flags blocked work and derives a critical path from estimated hours", () => {
    const summary = buildProjectTaskGraphSummary(
      [
        {
          id: "task-a",
          status: "in_progress",
          taskType: "full",
          isCompleted: false,
          estimatedHours: 4,
          predecessorTaskIds: []
        },
        {
          id: "task-b",
          status: "pending",
          taskType: "full",
          isCompleted: false,
          estimatedHours: 6,
          predecessorTaskIds: ["task-a"]
        },
        {
          id: "task-c",
          status: "pending",
          taskType: "full",
          isCompleted: false,
          estimatedHours: 2,
          predecessorTaskIds: ["task-b"]
        },
        {
          id: "task-d",
          status: "pending",
          taskType: "full",
          isCompleted: false,
          estimatedHours: 1,
          predecessorTaskIds: []
        }
      ],
      [
        { predecessorTaskId: "task-a", successorTaskId: "task-b" },
        { predecessorTaskId: "task-b", successorTaskId: "task-c" }
      ],
      new Map([
        ["task-a", 1.5],
        ["task-b", 0],
        ["task-c", 0],
        ["task-d", 0]
      ])
    );

    expect(summary.totalEstimatedHours).toBe(13);
    expect(summary.totalActualHours).toBe(1.5);
    expect(summary.remainingEstimatedHours).toBe(13);
    expect(summary.blockedTaskCount).toBe(2);
    expect(summary.criticalPathTaskIds).toEqual(["task-a", "task-b", "task-c"]);
    expect(summary.byTaskId.get("task-b")).toMatchObject({
      isBlocked: true,
      blockingTaskIds: ["task-a"],
      isCriticalPath: true
    });
    expect(summary.byTaskId.get("task-d")).toMatchObject({
      isBlocked: false,
      isCriticalPath: false
    });
  });

  it("rejects cyclic dependency rewrites", () => {
    expect(() => assertTaskDependenciesAcyclic(
      [
        { id: "task-a" },
        { id: "task-b" }
      ],
      [
        { predecessorTaskId: "task-a", successorTaskId: "task-b" }
      ],
      "task-a",
      ["task-b"]
    )).toThrow("cannot contain cycles");
  });
});

describe("project templates", () => {
  it("builds a reusable snapshot with relative dates and dependency links", () => {
    const snapshot = buildProjectTemplateSnapshot({
      status: "completed",
      description: "Annual winterization runbook",
      startDate: new Date("2026-10-01T00:00:00.000Z"),
      targetEndDate: new Date("2026-10-08T00:00:00.000Z"),
      budgetAmount: 1500,
      notes: "Reset each fall",
      assets: [
        {
          assetId: "asset-1",
          relationship: "target",
          role: "House",
          notes: null
        }
      ],
      budgetCategories: [
        {
          name: "Supplies",
          budgetAmount: 400,
          sortOrder: 0,
          notes: null
        }
      ],
      phases: [
        {
          id: "phase-1",
          name: "Inspection",
          description: null,
          status: "completed",
          sortOrder: 0,
          startDate: new Date("2026-10-01T00:00:00.000Z"),
          targetEndDate: new Date("2026-10-02T00:00:00.000Z"),
          budgetAmount: 100,
          notes: null
        }
      ],
      tasks: [
        {
          id: "task-1",
          phaseId: "phase-1",
          title: "Drain exterior hose bibs",
          description: null,
          taskType: "full",
          assignedToId: null,
          dueDate: new Date("2026-10-03T00:00:00.000Z"),
          estimatedCost: 0,
          estimatedHours: 1.5,
          sortOrder: 0,
          predecessorLinks: []
        },
        {
          id: "task-2",
          phaseId: "phase-1",
          title: "Blow out irrigation lines",
          description: null,
          taskType: "full",
          assignedToId: null,
          dueDate: new Date("2026-10-04T00:00:00.000Z"),
          estimatedCost: 120,
          estimatedHours: 3,
          sortOrder: 1,
          predecessorLinks: [{ predecessorTaskId: "task-1" }]
        }
      ]
    });

    expect(snapshot.project.status).toBe("planning");
    expect(snapshot.project.targetOffsetDays).toBe(7);
    expect(snapshot.phases[0]).toMatchObject({
      status: "pending",
      startOffsetDays: 0,
      targetOffsetDays: 1
    });
    expect(snapshot.tasks[1].predecessorTemplateTaskIds).toHaveLength(1);
    expect(snapshot.tasks[1].dueOffsetDays).toBe(3);
    expect(summarizeProjectTemplateSnapshot(snapshot)).toEqual({
      phaseCount: 1,
      taskCount: 2,
      assetCount: 1
    });
  });
});

describe("project status guardrails", () => {
  it("summarizes incomplete phase work for completion validation", async () => {
    const summary = await getPhaseCompletionSummary({
      projectPhase: {
        findUnique: async () => ({
          id: "phase-1",
          projectId: "project-1",
          name: "Rough-In",
          status: "in_progress",
          actualEndDate: null,
          tasks: [
            { status: "completed", taskType: "full", isCompleted: true },
            { status: "pending", taskType: "full", isCompleted: false }
          ],
          supplies: [
            { isProcured: true },
            { isProcured: false }
          ]
        })
      }
    } as never, "phase-1");

    expect(summary).toMatchObject({
      pendingTaskCount: 1,
      unprocuredSupplyCount: 1,
      canComplete: false
    });
    expect(buildPhaseCompletionGuardrailMessage(summary!)).toBe(
      "Cannot mark phase complete while 1 task still pending and 1 supply still unprocured."
    );
  });

  it("summarizes project completion blockers across phases and unphased tasks", async () => {
    const summary = await getProjectCompletionSummary({
      project: {
        findUnique: async () => ({
          id: "project-1",
          name: "Kitchen Remodel",
          phases: [
            {
              id: "phase-1",
              name: "Demo",
              status: "completed",
              actualEndDate: new Date("2026-03-10T00:00:00.000Z"),
              tasks: [{ status: "completed", taskType: "full", isCompleted: true }],
              supplies: []
            },
            {
              id: "phase-2",
              name: "Cabinet Install",
              status: "in_progress",
              actualEndDate: null,
              tasks: [{ status: "pending", taskType: "full", isCompleted: false }],
              supplies: []
            }
          ],
          tasks: [{ status: "pending", taskType: "quick", isCompleted: false }]
        })
      }
    } as never, "project-1");

    expect(summary).toMatchObject({
      incompletePhaseCount: 1,
      pendingUnphasedTaskCount: 1,
      canComplete: false
    });
    expect(buildProjectCompletionGuardrailMessage(summary!)).toBe(
      "Cannot mark project complete while 1 phase still incomplete (Cabinet Install) and 1 unphased task still pending."
    );
  });

  it("auto-reopens stale completed phases and projects when new incomplete work exists", async () => {
    const phaseUpdate = [] as Array<{ where: { id: string }; data: { status: string; actualEndDate: Date | null } }>;
    const projectUpdate = [] as Array<{ where: { id: string }; data: { status: string; actualEndDate: Date | null } }>;

    const result = await syncProjectDerivedStatuses({
      project: {
        findUnique: async () => ({
          id: "project-1",
          status: "completed",
          actualEndDate: new Date("2026-03-11T00:00:00.000Z"),
          phases: [
            {
              id: "phase-1",
              name: "Cabinet Install",
              status: "completed",
              actualEndDate: new Date("2026-03-10T00:00:00.000Z"),
              tasks: [{ status: "pending", taskType: "full", isCompleted: false }],
              supplies: [{ isProcured: true }]
            }
          ],
          tasks: []
        }),
        update: async (args: { where: { id: string }; data: { status: string; actualEndDate: Date | null } }) => {
          projectUpdate.push(args);
          return null;
        }
      },
      projectPhase: {
        update: async (args: { where: { id: string }; data: { status: string; actualEndDate: Date | null } }) => {
          phaseUpdate.push(args);
          return null;
        }
      }
    } as never, "project-1", new Date("2026-03-17T00:00:00.000Z"));

    expect(phaseUpdate).toEqual([
      {
        where: { id: "phase-1" },
        data: { status: "in_progress", actualEndDate: null }
      }
    ]);
    expect(projectUpdate).toEqual([
      {
        where: { id: "project-1" },
        data: { status: "active", actualEndDate: null }
      }
    ]);
    expect(result).toMatchObject({
      projectStatus: "active",
      phaseStatuses: [{ phaseId: "phase-1", status: "in_progress" }]
    });
  });
});