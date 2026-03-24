/**
 * Helpers for the soft-delete pattern used throughout the codebase.
 *
 * Models that support soft delete have a nullable `deletedAt` timestamp field.
 * Active records have `deletedAt: null`; deleted records have a non-null timestamp.
 *
 * Usage examples
 * --------------
 *
 *   // Filter to active records only (most common case)
 *   await prisma.asset.findMany({ where: { householdId, ...notDeleted() } });
 *
 *   // Conditionally include deleted records based on a query param
 *   await prisma.asset.findMany({ where: { householdId, ...optionallyIncludeDeleted(query.includeDeleted) } });
 *
 *   // Perform a soft delete
 *   await prisma.asset.update({ where: { id }, data: softDeleteData() });
 *
 *   // Restore a soft-deleted record
 *   await prisma.asset.update({ where: { id }, data: restoreData() });
 */

/** Returns `{ deletedAt: null }` for spreading into Prisma `where` clauses. */
export const notDeleted = (): { deletedAt: null } => ({ deletedAt: null });

/**
 * Conditionally adds `{ deletedAt: null }` to a Prisma `where` clause.
 * When `includeDeleted` is true, returns `{}` (no filter applied).
 * When false or undefined (the default), returns `{ deletedAt: null }`.
 */
export const optionallyIncludeDeleted = (
  includeDeleted: boolean | undefined
): { deletedAt: null } | Record<never, never> =>
  includeDeleted ? {} : { deletedAt: null };

/** Returns `{ deletedAt: new Date() }` for use as Prisma `update` data. */
export const softDeleteData = (): { deletedAt: Date } => ({
  deletedAt: new Date(),
});

/** Returns `{ deletedAt: null }` for use as Prisma `update` data (restore). */
export const restoreData = (): { deletedAt: null } => ({ deletedAt: null });
