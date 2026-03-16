import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { repairHouseholdProjectDepths } from "../lib/project-hierarchy.js";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const householdId = process.argv[2];

  if (householdId) {
    const result = await repairHouseholdProjectDepths(prisma, householdId);
    console.log(
      `Repaired project depths for household ${householdId} (visited=${result.updatedCount}, unreconciled=${result.unreconciledCount})`
    );
    return;
  }

  const households = await prisma.household.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" }
  });

  for (const household of households) {
    const result = await repairHouseholdProjectDepths(prisma, household.id);
    console.log(
      `Repaired project depths for household ${household.id} (visited=${result.updatedCount}, unreconciled=${result.unreconciledCount})`
    );
  }

  console.log(`Processed ${households.length} household(s)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });