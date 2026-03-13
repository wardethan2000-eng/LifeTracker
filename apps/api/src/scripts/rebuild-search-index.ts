import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { rebuildSearchIndex } from "../lib/search-index.js";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const householdId = process.argv[2];

  if (householdId) {
    await rebuildSearchIndex(prisma, householdId);
    console.log(`Rebuilt search index for household ${householdId}`);
    return;
  }

  const households = await prisma.household.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" }
  });

  for (const household of households) {
    await rebuildSearchIndex(prisma, household.id);
  }

  console.log(`Rebuilt search index for ${households.length} household(s)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });