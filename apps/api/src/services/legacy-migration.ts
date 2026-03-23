import type { PrismaClient } from "@prisma/client";

/**
 * Idempotent per-household legacy migration stamp.
 *
 * The AssetTimelineEntry, ProjectNote, and HobbyLog tables have been removed.
 * This function now simply stamps `legacyMigrationDoneAt` on households that
 * have not yet been marked, so the flag remains consistent across deployments.
 *
 * Errors are logged but never re-thrown so callers are not blocked.
 */
export const ensureLegacyEntriesMigrated = async (
  prisma: PrismaClient,
  householdId: string
): Promise<void> => {
  try {
    const household = await prisma.household.findUnique({
      where: { id: householdId },
      select: { legacyMigrationDoneAt: true }
    });

    if (!household || household.legacyMigrationDoneAt !== null) {
      return;
    }

    await prisma.household.update({
      where: { id: householdId },
      data: { legacyMigrationDoneAt: new Date() }
    });
  } catch (err) {
    console.error(`[legacy-migration] household=${householdId} failed:`, err);
  }
};
