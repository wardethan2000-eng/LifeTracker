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

const REFRESH_THROTTLE_MS = 15000;

export function RealtimeRefreshBoundary({ householdId, eventTypes }: RealtimeRefreshBoundaryProps): JSX.Element | null {
  const router = useRouter();
  const lastRefreshAtRef = useRef(0);

  useRealtimeUpdates({
    householdId,
    eventTypes,
    enabled: Boolean(householdId),
    onEvent: () => {
      if (process.env.NODE_ENV === "development") {
        return;
      }

      const now = Date.now();

      if (now - lastRefreshAtRef.current < REFRESH_THROTTLE_MS) {
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