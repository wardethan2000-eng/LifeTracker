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

  const allDueWork = dashboard.dueWork as DueWorkItem[];
  const allOverdue = allDueWork.filter((i) => i.status === "overdue");
  const allDue = allDueWork.filter((i) => i.status === "due");

  return (
    <DashboardAttentionQueue
      overdueItems={allOverdue.slice(0, 5)}
      dueItems={allDue.slice(0, 5)}
      totalOverdueCount={allOverdue.length}
      totalDueCount={allDue.length}
      householdId={householdId}
    />
  );
}
