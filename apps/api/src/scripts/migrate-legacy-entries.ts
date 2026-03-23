import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { ensureLegacyEntriesMigrated } from "../services/legacy-migration.js";

/**
 * CLI wrapper around the legacy migration service.
 *
 * Usage:
 *   node migrate-legacy-entries.js <householdId>   # migrate a single household
 *   node migrate-legacy-entries.js --all           # migrate every household
 */

const prisma = new PrismaClient();

const householdIdArg = process.argv[2];

async function main(): Promise<void> {
  if (householdIdArg === "--all") {
    const households = await prisma.household.findMany({
      where: { legacyMigrationDoneAt: null },
      select: { id: true }
    });

    console.log(`Migrating ${households.length} household(s) with pending legacy entries...`);

    for (const { id } of households) {
      await ensureLegacyEntriesMigrated(prisma, id);
    }

    console.log("All households migrated.");
  } else if (householdIdArg) {
    console.log(`Migrating household ${householdIdArg}...`);
    await ensureLegacyEntriesMigrated(prisma, householdIdArg);
    console.log("Done.");
  } else {
    console.error("Usage: migrate-legacy-entries.js <householdId> | --all");
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Legacy entry migration failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });