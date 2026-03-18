type TaskGraphTask = {
  id: string;
  status: string;
  taskType?: string | null;
  isCompleted?: boolean | null;
  estimatedHours?: number | null;
  predecessorTaskIds: string[];
};

type DependencyEdge = {
  predecessorTaskId: string;
  successorTaskId: string;
};

type TaskGraphNode = {
  predecessorTaskIds: string[];
  successorTaskIds: string[];
  blockingTaskIds: string[];
  isBlocked: boolean;
  isCriticalPath: boolean;
};

type ProjectTaskGraphSummary = {
  byTaskId: Map<string, TaskGraphNode>;
  criticalPathTaskIds: string[];
  criticalPathHours: number;
  totalEstimatedHours: number;
  totalActualHours: number;
  remainingEstimatedHours: number;
  blockedTaskCount: number;
  criticalTaskCount: number;
};

const isTaskDone = (task: Pick<TaskGraphTask, "status" | "taskType" | "isCompleted">): boolean => (
  task.status === "completed"
  || task.status === "skipped"
  || (task.taskType === "quick" && Boolean(task.isCompleted))
);

const getTaskDuration = (task: Pick<TaskGraphTask, "estimatedHours" | "taskType">): number => {
  if (typeof task.estimatedHours === "number" && Number.isFinite(task.estimatedHours) && task.estimatedHours >= 0) {
    return task.estimatedHours;
  }

  return task.taskType === "quick" ? 0.25 : 1;
};

const buildAdjacency = (tasks: TaskGraphTask[], dependencies: DependencyEdge[]) => {
  const taskIds = new Set(tasks.map((task) => task.id));
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();

  for (const task of tasks) {
    predecessors.set(task.id, []);
    successors.set(task.id, []);
  }

  for (const dependency of dependencies) {
    if (!taskIds.has(dependency.predecessorTaskId) || !taskIds.has(dependency.successorTaskId)) {
      continue;
    }

    predecessors.get(dependency.successorTaskId)?.push(dependency.predecessorTaskId);
    successors.get(dependency.predecessorTaskId)?.push(dependency.successorTaskId);
  }

  return { predecessors, successors };
};

export const assertTaskDependenciesAcyclic = (
  tasks: Array<{ id: string }>,
  dependencies: DependencyEdge[],
  targetTaskId: string,
  predecessorTaskIds: string[]
): void => {
  const taskIds = new Set(tasks.map((task) => task.id));

  for (const predecessorTaskId of predecessorTaskIds) {
    if (predecessorTaskId === targetTaskId) {
      throw new Error("A task cannot depend on itself.");
    }

    if (!taskIds.has(predecessorTaskId)) {
      throw new Error("A referenced dependency task was not found in this project.");
    }
  }

  const nextDependencies = dependencies
    .filter((dependency) => dependency.successorTaskId !== targetTaskId)
    .concat(predecessorTaskIds.map((predecessorTaskId) => ({ predecessorTaskId, successorTaskId: targetTaskId })));
  const adjacency = new Map<string, string[]>();

  for (const taskId of taskIds) {
    adjacency.set(taskId, []);
  }

  for (const dependency of nextDependencies) {
    adjacency.get(dependency.predecessorTaskId)?.push(dependency.successorTaskId);
  }

  const visited = new Set<string>();
  const active = new Set<string>();

  const visit = (taskId: string): boolean => {
    if (active.has(taskId)) {
      return true;
    }

    if (visited.has(taskId)) {
      return false;
    }

    visited.add(taskId);
    active.add(taskId);

    for (const nextTaskId of adjacency.get(taskId) ?? []) {
      if (visit(nextTaskId)) {
        return true;
      }
    }

    active.delete(taskId);
    return false;
  };

  for (const taskId of taskIds) {
    if (visit(taskId)) {
      throw new Error("Task dependencies cannot contain cycles.");
    }
  }
};

export const buildProjectTaskGraphSummary = (
  tasks: TaskGraphTask[],
  dependencies: DependencyEdge[],
  actualHoursByTaskId?: Map<string, number>
): ProjectTaskGraphSummary => {
  const { predecessors, successors } = buildAdjacency(tasks, dependencies);
  const remainingTaskIds = new Set(tasks.filter((task) => !isTaskDone(task)).map((task) => task.id));
  const byTaskId = new Map<string, TaskGraphNode>();
  let totalEstimatedHours = 0;
  let totalActualHours = 0;
  let remainingEstimatedHours = 0;
  let blockedTaskCount = 0;

  for (const task of tasks) {
    const predecessorTaskIds = predecessors.get(task.id) ?? [];
    const successorTaskIds = successors.get(task.id) ?? [];
    const blockingTaskIds = predecessorTaskIds.filter((predecessorTaskId) => {
      const predecessorTask = tasks.find((candidate) => candidate.id === predecessorTaskId);
      return predecessorTask ? !isTaskDone(predecessorTask) : false;
    });
    const estimatedHours = getTaskDuration(task);
    const actualHours = actualHoursByTaskId?.get(task.id) ?? 0;

    totalEstimatedHours += estimatedHours;
    totalActualHours += actualHours;

    if (!isTaskDone(task)) {
      remainingEstimatedHours += estimatedHours;
    }

    if (blockingTaskIds.length > 0 && remainingTaskIds.has(task.id)) {
      blockedTaskCount += 1;
    }

    byTaskId.set(task.id, {
      predecessorTaskIds,
      successorTaskIds,
      blockingTaskIds,
      isBlocked: blockingTaskIds.length > 0 && remainingTaskIds.has(task.id),
      isCriticalPath: false
    });
  }

  const remainingTasks = tasks.filter((task) => remainingTaskIds.has(task.id));
  const indegree = new Map<string, number>();
  const predecessorChoice = new Map<string, string | null>();
  const distance = new Map<string, number>();
  const queue: string[] = [];

  for (const task of remainingTasks) {
    const remainingPredecessors = (predecessors.get(task.id) ?? []).filter((predecessorTaskId) => remainingTaskIds.has(predecessorTaskId));
    indegree.set(task.id, remainingPredecessors.length);
    distance.set(task.id, getTaskDuration(task));
    predecessorChoice.set(task.id, null);
    if (remainingPredecessors.length === 0) {
      queue.push(task.id);
    }
  }

  const topo: string[] = [];

  while (queue.length > 0) {
    const taskId = queue.shift()!;
    topo.push(taskId);

    for (const successorTaskId of successors.get(taskId) ?? []) {
      if (!remainingTaskIds.has(successorTaskId)) {
        continue;
      }

      const nextInDegree = (indegree.get(successorTaskId) ?? 0) - 1;
      indegree.set(successorTaskId, nextInDegree);
      if (nextInDegree === 0) {
        queue.push(successorTaskId);
      }
    }
  }

  if (topo.length !== remainingTasks.length) {
    throw new Error("Task dependencies cannot contain cycles.");
  }

  for (const taskId of topo) {
    const task = tasks.find((candidate) => candidate.id === taskId);

    if (!task) {
      continue;
    }

    const taskDistance = distance.get(taskId) ?? getTaskDuration(task);

    for (const successorTaskId of successors.get(taskId) ?? []) {
      if (!remainingTaskIds.has(successorTaskId)) {
        continue;
      }

      const successorTask = tasks.find((candidate) => candidate.id === successorTaskId);

      if (!successorTask) {
        continue;
      }

      const candidateDistance = taskDistance + getTaskDuration(successorTask);
      if (candidateDistance > (distance.get(successorTaskId) ?? 0)) {
        distance.set(successorTaskId, candidateDistance);
        predecessorChoice.set(successorTaskId, taskId);
      }
    }
  }

  let criticalPathEndTaskId: string | null = null;
  let criticalPathHours = 0;

  for (const [taskId, taskDistance] of distance.entries()) {
    if (taskDistance > criticalPathHours) {
      criticalPathHours = taskDistance;
      criticalPathEndTaskId = taskId;
    }
  }

  const criticalPathTaskIds: string[] = [];
  while (criticalPathEndTaskId) {
    criticalPathTaskIds.unshift(criticalPathEndTaskId);
    criticalPathEndTaskId = predecessorChoice.get(criticalPathEndTaskId) ?? null;
  }

  for (const taskId of criticalPathTaskIds) {
    const existing = byTaskId.get(taskId);
    if (existing) {
      existing.isCriticalPath = true;
    }
  }

  return {
    byTaskId,
    criticalPathTaskIds,
    criticalPathHours,
    totalEstimatedHours,
    totalActualHours,
    remainingEstimatedHours,
    blockedTaskCount,
    criticalTaskCount: criticalPathTaskIds.length
  };
};