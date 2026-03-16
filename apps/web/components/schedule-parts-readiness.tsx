"use client";

import type { SchedulePartsReadiness } from "@lifekeeper/types";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { getSchedulePartsReadiness } from "../lib/api";

type SchedulePartsReadinessProps = {
  assetId: string;
  scheduleId: string;
};

export function SchedulePartsReadiness({ assetId, scheduleId }: SchedulePartsReadinessProps): JSX.Element {
  const [readiness, setReadiness] = useState<SchedulePartsReadiness | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadReadiness = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextReadiness = await getSchedulePartsReadiness(assetId, scheduleId);

        if (cancelled) {
          return;
        }

        setReadiness(nextReadiness);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setReadiness(null);
        setErrorMessage(error instanceof Error ? error.message : "Failed to check parts readiness.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadReadiness();

    return () => {
      cancelled = true;
    };
  }, [assetId, scheduleId]);

  const deficitItems = useMemo(() => readiness?.items.filter((item) => item.deficit > 0) ?? [], [readiness]);

  if (isLoading) {
    return <section className="parts-readiness parts-readiness--loading">Checking parts...</section>;
  }

  if (errorMessage) {
    return <section className="parts-readiness parts-readiness--warning">{errorMessage}</section>;
  }

  if (!readiness || readiness.totalLinkedItems === 0) {
    return <section className="parts-readiness parts-readiness--empty">No parts linked to this schedule.</section>;
  }

  return (
    <section className={`parts-readiness parts-readiness--${readiness.allReady ? "ready" : "warning"}`}>
      <div className="parts-readiness__summary">
        <span className="parts-readiness__dot" aria-hidden="true" />
        <div>
          <strong>{readiness.allReady ? "All parts in stock" : `${readiness.readyCount} of ${readiness.totalLinkedItems} parts in stock`}</strong>
          <p>{readiness.readyCount} ready out of {readiness.totalLinkedItems} linked part{readiness.totalLinkedItems === 1 ? "" : "s"}.</p>
        </div>
      </div>

      {!readiness.allReady && deficitItems.length > 0 ? (
        <div className="parts-readiness__list">
          {deficitItems.map((item) => (
            <div key={item.inventoryItemId} className="parts-readiness__item">
              <div>
                <div className="parts-readiness__item-name">{item.itemName}</div>
                <div className="parts-readiness__item-meta">Need {item.quantityNeeded} {item.unit}, have {item.quantityOnHand}</div>
              </div>
              <span className="parts-readiness__deficit">Short {item.deficit}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}