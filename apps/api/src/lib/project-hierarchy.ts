import type { Prisma, PrismaClient } from "@prisma/client";

type ProjectHierarchyPrisma = PrismaClient | Prisma.TransactionClient;

export class ProjectHierarchyValidationError extends Error {}

export const resolveProjectHierarchyInput = async (
  prisma: ProjectHierarchyPrisma,
  options: {
    householdId: string;
    parentProjectId: string | null;
    projectId?: string;
  }
): Promise<{ parentProjectId: string | null; depth: number }> => {
  if (options.parentProjectId === null) {
    return {
      parentProjectId: null,
      depth: 0
    };
  }

  if (options.projectId && options.parentProjectId === options.projectId) {
    throw new ProjectHierarchyValidationError("A project cannot be its own parent.");
  }

  const parentProject = await prisma.project.findFirst({
    where: {
      id: options.parentProjectId,
      householdId: options.householdId,
      deletedAt: null
    },
    select: {
      id: true,
      depth: true
    }
  });

  if (!parentProject) {
    throw new ProjectHierarchyValidationError("Parent project not found in this household.");
  }

  if (options.projectId) {
    const descendants = await prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE tree AS (
        SELECT id FROM "Project" WHERE "parentProjectId" = ${options.projectId} AND "deletedAt" IS NULL
        UNION ALL
        SELECT p.id FROM "Project" p JOIN tree t ON p."parentProjectId" = t.id WHERE p."deletedAt" IS NULL
      )
      SELECT id FROM tree
    `;

    if (descendants.some((descendant: { id: string }) => descendant.id === options.parentProjectId)) {
      throw new ProjectHierarchyValidationError(
        "Cannot set parent to a descendant project - this would create a circular reference."
      );
    }
  }

  return {
    parentProjectId: parentProject.id,
    depth: parentProject.depth + 1
  };
};

export const syncProjectTreeDepths = async (
  prisma: ProjectHierarchyPrisma,
  rootProjectId: string
): Promise<void> => {
  await prisma.$executeRaw`
    WITH RECURSIVE tree AS (
      SELECT id, "parentProjectId", depth
      FROM "Project"
      WHERE id = ${rootProjectId}
        AND "deletedAt" IS NULL
      UNION ALL
      SELECT child.id, child."parentProjectId", tree.depth + 1
      FROM "Project" child
      JOIN tree ON child."parentProjectId" = tree.id
      WHERE child."deletedAt" IS NULL
    )
    UPDATE "Project" AS target
    SET depth = tree.depth
    FROM tree
    WHERE target.id = tree.id
      AND target.depth IS DISTINCT FROM tree.depth
  `;
};

export const repairHouseholdProjectDepths = async (
  prisma: ProjectHierarchyPrisma,
  householdId: string
): Promise<{ updatedCount: number; unreconciledCount: number }> => {
  await prisma.$executeRaw`
    WITH RECURSIVE tree AS (
      SELECT id, 0 AS expected_depth
      FROM "Project"
      WHERE "householdId" = ${householdId}
        AND "parentProjectId" IS NULL
        AND "deletedAt" IS NULL
      UNION ALL
      SELECT child.id, tree.expected_depth + 1
      FROM "Project" child
      JOIN tree ON child."parentProjectId" = tree.id
      WHERE child."householdId" = ${householdId}
        AND child."deletedAt" IS NULL
    )
    UPDATE "Project" AS target
    SET depth = tree.expected_depth
    FROM tree
    WHERE target.id = tree.id
      AND target."householdId" = ${householdId}
      AND target.depth IS DISTINCT FROM tree.expected_depth
  `;

  const updatedRows = await prisma.$queryRaw<{ updated_count: bigint }[]>`
    WITH RECURSIVE tree AS (
      SELECT id, 0 AS expected_depth
      FROM "Project"
      WHERE "householdId" = ${householdId}
        AND "parentProjectId" IS NULL
        AND "deletedAt" IS NULL
      UNION ALL
      SELECT child.id, tree.expected_depth + 1
      FROM "Project" child
      JOIN tree ON child."parentProjectId" = tree.id
      WHERE child."householdId" = ${householdId}
        AND child."deletedAt" IS NULL
    )
    SELECT COUNT(*)::bigint AS updated_count
    FROM "Project" project
    JOIN tree ON tree.id = project.id
    WHERE project."householdId" = ${householdId}
      AND project.depth = tree.expected_depth
  `;

  const unreconciledRows = await prisma.$queryRaw<{ unreconciled_count: bigint }[]>`
    WITH RECURSIVE tree AS (
      SELECT id
      FROM "Project"
      WHERE "householdId" = ${householdId}
        AND "parentProjectId" IS NULL
      UNION ALL
      SELECT child.id
      FROM "Project" child
      JOIN tree ON child."parentProjectId" = tree.id
      WHERE child."householdId" = ${householdId}
    )
    SELECT COUNT(*)::bigint AS unreconciled_count
    FROM "Project"
    WHERE "householdId" = ${householdId}
      AND id NOT IN (SELECT id FROM tree)
  `;

  const updatedCount = updatedRows[0]?.updated_count ?? 0n;
  const unreconciledCount = unreconciledRows[0]?.unreconciled_count ?? 0n;

  return {
    updatedCount: Number(updatedCount),
    unreconciledCount: Number(unreconciledCount)
  };
};