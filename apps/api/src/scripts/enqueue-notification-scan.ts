import "dotenv/config";
import { enqueueNotificationScan } from "../lib/queues.js";

const householdId = process.argv[2];

async function main(): Promise<void> {
  const job = await enqueueNotificationScan(householdId ? { householdId } : {});

  console.log(JSON.stringify({
    jobId: job.id,
    householdId: householdId ?? null
  }, null, 2));
}

void main();