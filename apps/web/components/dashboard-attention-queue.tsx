"use client";

import type { DueWorkItem } from "@aegis/types";
import type { JSX } from "react";
import Link from "next/link";
import { useCompletionSlideOver } from "./completion-slide-over-context";

type AttentionQueueProps = {
  overdueItems: DueWorkItem[];
  dueItems: DueWorkItem[];
  totalOverdueCount: number;
  totalDueCount: number;
  householdId: string;
};

function relativeOverdueLabel(nextDueAt: string | null): { label: string; days: number } {
  if (!nextDueAt) return { label: "Overdue", days: 0 };
  const due = new Date(nextDueAt);
  const now = new Date();
  const diffMs = now.getTime() - due.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return { label: "Due today", days: 0 };
  if (diffDays === 1) return { label: "1 day overdue", days: 1 };
  if (diffDays < 30) return { label: `${diffDays} days overdue`, days: diffDays };
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 8) return { label: `${diffWeeks} weeks overdue`, days: diffDays };
  const diffMonths = Math.floor(diffDays / 30);
  return { label: `${diffMonths} months overdue`, days: diffDays };
}

const urgencyWidth = (days: number): number => {
  // Scale 0–90 days to 10–100%
  if (days <= 0) return 10;
  return Math.min(100, 10 + Math.round((days / 90) * 90));
};

function QueueItem({ item, variant, householdId }: { item: DueWorkItem; variant: "overdue" | "due"; householdId: string }): JSX.Element {
  const { openSlideOver } = useCompletionSlideOver();
  const { label: ageLabel, days } = variant === "overdue"
    ? relativeOverdueLabel(item.nextDueAt)
    : { label: "Due today", days: 0 };

  const handleLog = (): void => {
    openSlideOver({
      assetId: item.assetId,
      assetName: item.assetName,
      scheduleId: item.scheduleId,
      scheduleName: item.scheduleName,
      householdId,
    });
  };

  return (
    <div className={`attention-queue__item attention-queue__item--${variant}`}>
      {variant === "overdue" && (
        <div className="attention-queue__urgency-track" aria-hidden="true">
          <div className="attention-queue__urgency-fill" style={{ width: `${urgencyWidth(days)}%` }} />
        </div>
      )}
      <div className="attention-queue__item-body">
        <div className="attention-queue__item-main">
          <Link href={`/assets/${item.assetId}`} className="attention-queue__asset-link">
            {item.assetName}
          </Link>
          <span className="attention-queue__schedule-name">{item.scheduleName}</span>
        </div>
        <div className="attention-queue__item-meta">
          <span className={`attention-queue__age-pill attention-queue__age-pill--${variant}`}>
            {ageLabel}
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
    </div>
  );
}

const OverdueIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const DueIcon = (): JSX.Element => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

export function DashboardAttentionQueue({ overdueItems, dueItems, totalOverdueCount, totalDueCount, householdId }: AttentionQueueProps): JSX.Element | null {
  const totalCount = totalOverdueCount + totalDueCount;

  if (totalCount === 0) {
    return (
      <div className="attention-queue attention-queue--clear">
        <span className="attention-queue__clear-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <strong>Nothing due today — you&rsquo;re on top of it.</strong>
      </div>
    );
  }

  return (
    <div className="attention-queue">
      {totalOverdueCount > 0 && (
        <div className="attention-queue__group">
          <div className="attention-queue__group-header attention-queue__group-header--overdue">
            <OverdueIcon />
            <span className="attention-queue__count attention-queue__count--overdue">{totalOverdueCount}</span>
            <span className="attention-queue__group-label">overdue</span>
            {totalOverdueCount > overdueItems.length && (
              <Link href="/maintenance?status=overdue" className="attention-queue__see-all">
                See all {totalOverdueCount} →
              </Link>
            )}
          </div>
          <div className="attention-queue__items">
            {overdueItems.map((item) => (
              <QueueItem key={item.scheduleId} item={item} variant="overdue" householdId={householdId} />
            ))}
          </div>
        </div>
      )}

      {totalDueCount > 0 && (
        <div className="attention-queue__group">
          <div className="attention-queue__group-header attention-queue__group-header--due">
            <DueIcon />
            <span className="attention-queue__count attention-queue__count--due">{totalDueCount}</span>
            <span className="attention-queue__group-label">{totalDueCount === 1 ? "item" : "items"} due now</span>
            {totalDueCount > dueItems.length && (
              <Link href="/maintenance?status=due" className="attention-queue__see-all">
                See all {totalDueCount} →
              </Link>
            )}
          </div>
          <div className="attention-queue__items">
            {dueItems.map((item) => (
              <QueueItem key={item.scheduleId} item={item} variant="due" householdId={householdId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
