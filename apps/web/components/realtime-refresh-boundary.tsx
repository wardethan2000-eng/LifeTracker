"use client";

import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useRef, startTransition } from "react";
import type { RealtimeEventType } from "../lib/realtime-events";
import { useRealtimeUpdates } from "./use-realtime-updates";

type RealtimeRefreshBoundaryProps = {
  householdId: string | null;
  eventTypes: RealtimeEventType[];
};

export function RealtimeRefreshBoundary({ householdId, eventTypes }: RealtimeRefreshBoundaryProps): JSX.Element | null {
  const router = useRouter();
  const lastRefreshAtRef = useRef(0);

  useRealtimeUpdates({
    householdId,
    eventTypes,
    enabled: Boolean(householdId),
    onEvent: () => {
      const now = Date.now();

      if (now - lastRefreshAtRef.current < 1000) {
        return;
      }

      lastRefreshAtRef.current = now;
      startTransition(() => {
        router.refresh();
      });
    }
  });

  return null;
}