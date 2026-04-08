"use client";

import type { DueWorkItem } from "@aegis/types";
import type { JSX } from "react";
import Link from "next/link";
import { useCompletionSlideOver } from "./completion-slide-over-context";

type AttentionQueueProps = {
  overdueItems: DueWorkItem[];
  dueItems: DueWorkItem[];
};

function relativeOverdueLabel(nextDueAt: string | null): string {
  if (!nextDueAt) return "Overdue";
  const due = new Date(nextDueAt);
  const now = new Date();
  const diffMs = now.getTime() - due.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Due today";
  if (diffDays === 1) return "1 day overdue";
  if (diffDays < 30) return `${diffDays} days overdue`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 8) return `${diffWeeks} weeks overdue`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} months overdue`;
}

function QueueItem({ item, variant }: { item: DueWorkItem; variant: "overdue" | "due" }): JSX.Element {
  const { openSlideOver } = useCompletionSlideOver();

  const handleLog = (): void => {
    openSlideOver({
      assetId: item.assetId,
      assetName: item.assetName,
      scheduleId: item.scheduleId,
      scheduleName: item.scheduleName,
    });
  };

  return (
    <div className={`attention-queue__item attention-queue__item--${variant}`}>
      <div className="attention-queue__item-main">
        <Link href={`/assets/${item.assetId}`} className="attention-queue__asset-link">
          {item.assetName}
        </Link>
        <span className="attention-queue__schedule-name">{item.scheduleName}</span>
      </div>
      <div className="attention-queue__item-meta">
        <span className={`attention-queue__age attention-queue__age--${variant}`}>
          {variant === "overdue"
            ? relativeOverdueLabel(item.nextDueAt)
            : "Due today"}
        </span>
        <button
          type="button"
          className="button button--sm button--ghost attention-queue__log-btn"
          onClick={handleLog}
        >
          Log
        </button>
      </div>
    </div>
  );
}

export function DashboardAttentionQueue({ overdueItems, dueItems }: AttentionQueueProps): JSX.Element | null {
  const totalCount = overdueItems.length + dueItems.length;

  if (totalCount === 0) {
    return (
      <div className="attention-queue attention-queue--clear">
        <span className="attention-queue__clear-icon" aria-hidden="true">✓</span>
        <strong>Nothing due today — you&rsquo;re on top of it.</strong>
      </div>
    );
  }

  return (
    <div className="attention-queue">
      {overdueItems.length > 0 && (
        <div className="attention-queue__group">
          <div className="attention-queue__group-header attention-queue__group-header--overdue">
            <span className="attention-queue__count">{overdueItems.length}</span>
            <span>overdue</span>
            {overdueItems.length > 5 && (
              <Link href="/maintenance?status=overdue" className="attention-queue__see-all">
                See all →
              </Link>
            )}
          </div>
          <div className="attention-queue__items">
            {overdueItems.slice(0, 5).map((item) => (
              <QueueItem key={item.scheduleId} item={item} variant="overdue" />
            ))}
          </div>
        </div>
      )}

      {dueItems.length > 0 && (
        <div className="attention-queue__group">
          <div className="attention-queue__group-header attention-queue__group-header--due">
            <span className="attention-queue__count">{dueItems.length}</span>
            <span>{dueItems.length === 1 ? "item" : "items"} due now</span>
            {dueItems.length > 5 && (
              <Link href="/maintenance?status=due" className="attention-queue__see-all">
                See all →
              </Link>
            )}
          </div>
          <div className="attention-queue__items">
            {dueItems.slice(0, 5).map((item) => (
              <QueueItem key={item.scheduleId} item={item} variant="due" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
