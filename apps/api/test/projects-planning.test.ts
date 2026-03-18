import { describe, expect, it } from "vitest";
import { buildProjectTemplateSnapshot, summarizeProjectTemplateSnapshot } from "../src/lib/project-templates.js";
import { assertTaskDependenciesAcyclic, buildProjectTaskGraphSummary } from "../src/lib/project-task-graph.js";

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