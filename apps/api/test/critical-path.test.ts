import { describe, expect, it } from "vitest";
import { buildProjectTaskGraphSummary } from "../src/lib/project-task-graph.js";

const makeTask = (id: string, predecessorTaskIds: string[] = [], estimatedHours = 1) => ({
  id,
  status: "pending" as const,
  taskType: "full",
  isCompleted: false,
  estimatedHours,
  predecessorTaskIds
});

const makeDeps = (tasks: Array<{ id: string; predecessorTaskIds: string[] }>) =>
  tasks.flatMap((task) =>
    task.predecessorTaskIds.map((predecessorTaskId) => ({
      predecessorTaskId,
      successorTaskId: task.id
    }))
  );

describe("buildProjectTaskGraphSummary — critical path", () => {
  it("linear chain A→B→C: all tasks are critical", () => {
    const tasks = [makeTask("A"), makeTask("B", ["A"]), makeTask("C", ["B"])];
    const deps = makeDeps(tasks);
    const result = buildProjectTaskGraphSummary(tasks, deps);

    expect(result.criticalPathTaskIds).toEqual(["A", "B", "C"]);
    expect(result.byTaskId.get("A")?.isCriticalPath).toBe(true);
    expect(result.byTaskId.get("B")?.isCriticalPath).toBe(true);
    expect(result.byTaskId.get("C")?.isCriticalPath).toBe(true);
  });

  it("diamond A→B, A→C, B→D, C→D: longer branch B is critical; C is not", () => {
    // A=1h, B=3h, C=1h, D=1h → A+B+D=5h vs A+C+D=3h
    const tasks = [
      makeTask("A", [], 1),
      makeTask("B", ["A"], 3),
      makeTask("C", ["A"], 1),
      makeTask("D", ["B", "C"], 1)
    ];
    const deps = makeDeps(tasks);
    const result = buildProjectTaskGraphSummary(tasks, deps);

    expect(result.criticalPathTaskIds).toContain("A");
    expect(result.criticalPathTaskIds).toContain("B");
    expect(result.criticalPathTaskIds).toContain("D");
    expect(result.criticalPathTaskIds).not.toContain("C");
    expect(result.byTaskId.get("C")?.isCriticalPath).toBe(false);
  });

  it("empty task list: returns empty critical path", () => {
    const result = buildProjectTaskGraphSummary([], []);
    expect(result.criticalPathTaskIds).toEqual([]);
    expect(result.criticalPathHours).toBe(0);
  });

  it("two independent chains: returns the longer chain as critical path", () => {
    // Chain 1: X→Y (1+1=2h)  Chain 2: P→Q→R (1+1+1=3h)
    const tasks = [
      makeTask("X", [], 1),
      makeTask("Y", ["X"], 1),
      makeTask("P", [], 1),
      makeTask("Q", ["P"], 1),
      makeTask("R", ["Q"], 1)
    ];
    const deps = makeDeps(tasks);
    const result = buildProjectTaskGraphSummary(tasks, deps);

    expect(result.criticalPathHours).toBe(3);
    expect(result.criticalPathTaskIds).toContain("P");
    expect(result.criticalPathTaskIds).toContain("Q");
    expect(result.criticalPathTaskIds).toContain("R");
  });

  it("predecessor / successor task IDs are correctly populated", () => {
    const tasks = [makeTask("A"), makeTask("B", ["A"])];
    const deps = makeDeps(tasks);
    const result = buildProjectTaskGraphSummary(tasks, deps);

    expect(result.byTaskId.get("A")?.successorTaskIds).toEqual(["B"]);
    expect(result.byTaskId.get("B")?.predecessorTaskIds).toEqual(["A"]);
    expect(result.byTaskId.get("A")?.predecessorTaskIds).toEqual([]);
  });

  it("completed tasks are excluded from critical path computation", () => {
    // A(done)→B→C — A is complete, so critical path is B+C only
    const tasks = [
      { ...makeTask("A"), status: "completed" as const },
      makeTask("B", ["A"]),
      makeTask("C", ["B"])
    ];
    const deps = makeDeps(tasks);
    const result = buildProjectTaskGraphSummary(tasks, deps);

    // Completed tasks are excluded from critical path (only remaining tasks counted)
    expect(result.criticalPathTaskIds).not.toContain("A");
    expect(result.criticalPathTaskIds).toContain("B");
    expect(result.criticalPathTaskIds).toContain("C");
  });
});
