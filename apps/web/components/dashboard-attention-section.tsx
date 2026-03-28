import type { DueWorkItem } from "@lifekeeper/types";
import { getDashboardData } from "./dashboard-data";
import { DashboardAttentionQueue } from "./dashboard-attention-queue";

/**
 * Async server component. Calls getDashboardData (React-cached) and renders
 * the attention queue immediately — before the secondary dashboard cards load.
 * Wrapped in <Suspense> in page.tsx so it streams in independently.
 */
export async function DashboardAttentionSection({ householdId }: { householdId: string }) {
  const dashboard = await getDashboardData(householdId);

  const dueWork = dashboard.dueWork.slice(0, 8) as DueWorkItem[];

  return (
    <DashboardAttentionQueue
      overdueItems={dueWork.filter((i) => i.status === "overdue")}
      dueItems={dueWork.filter((i) => i.status === "due")}
    />
  );
}
