import type { AssetDetailResponse, HouseholdMember } from "@aegis/types";
import type { JSX } from "react";
import {
  completeScheduleAction,
  createLogAction,
  createScheduleAction,
  deleteScheduleAction,
  toggleScheduleActiveAction
} from "../app/actions";
import { AssetMaintenanceSections } from "./asset-maintenance-sections";
import { Card } from "./card";
import { formatDueLabel } from "../lib/formatters";

type AssetMaintenanceTabProps = {
  detail: AssetDetailResponse;
  householdMembers: HouseholdMember[];
  procedures?: { id: string; title: string }[];
};

export async function AssetMaintenanceTab({ detail, householdMembers, procedures }: AssetMaintenanceTabProps): Promise<JSX.Element> {
  const overdueCount = detail.schedules.filter((schedule) => schedule.status === "overdue").length;
  const dueCount = detail.schedules.filter((schedule) => schedule.status === "due").length;
  const upcomingCount = detail.schedules.filter((schedule) => schedule.status === "upcoming").length;
  const nextDue = detail.schedules
    .filter((schedule) => schedule.isActive && schedule.nextDueAt)
    .sort((left, right) => (left.nextDueAt! < right.nextDueAt! ? -1 : 1))[0] ?? null;

  return (
    <div className="resource-layout">
      <div className="resource-layout__primary">
        <AssetMaintenanceSections
          detail={detail}
          {...(procedures ? { procedures } : {})}
          createScheduleAction={createScheduleAction}
          completeScheduleAction={completeScheduleAction}
          toggleScheduleActiveAction={toggleScheduleActiveAction}
          deleteScheduleAction={deleteScheduleAction}
          createLogAction={createLogAction}
        />
      </div>

      <div className="resource-layout__aside">
        <Card title="Schedule Health">
          <dl className="schedule-meta">
            <div>
              <dt>Total schedules</dt>
              <dd>{detail.schedules.length}</dd>
            </div>
            <div>
              <dt>Overdue</dt>
              <dd>
                {overdueCount > 0 ? (
                  <span className="pill pill--danger">{overdueCount}</span>
                ) : (
                  <span style={{ color: "var(--ink-muted)" }}>None</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Due now</dt>
              <dd>
                {dueCount > 0 ? (
                  <span className="pill pill--warning">{dueCount}</span>
                ) : (
                  <span style={{ color: "var(--ink-muted)" }}>None</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Upcoming</dt>
              <dd>{upcomingCount}</dd>
            </div>
            <div>
              <dt>Assignable members</dt>
              <dd>{householdMembers.length}</dd>
            </div>
            <div>
              <dt>Next due</dt>
              <dd>
                {nextDue ? (
                  <>
                    <span style={{ fontWeight: 500 }}>{nextDue.name}</span>
                    <br />
                    <span style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
                      {formatDueLabel(nextDue.nextDueAt, nextDue.nextDueMetricValue, null)}
                    </span>
                  </>
                ) : (
                  <span style={{ color: "var(--ink-muted)" }}>None scheduled</span>
                )}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
