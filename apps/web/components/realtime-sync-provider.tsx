"use client";

import { createContext, type JSX, type ReactNode, startTransition, useContext, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RealtimeConnectionState } from "./use-realtime-updates";
import { useRealtimeUpdates } from "./use-realtime-updates";

type RealtimeSyncProviderProps = {
  householdId: string | null;
  children: ReactNode;
};

type RealtimeContextValue = {
  connectionState: RealtimeConnectionState;
};

const RealtimeContext = createContext<RealtimeContextValue>({ connectionState: "idle" });

const AUTO_REFRESH_THROTTLE_MS = 15000;

const shouldRefreshForPath = (pathname: string, eventType: string): boolean => {
  if (pathname === "/") {
    return eventType === "asset.updated"
      || eventType === "inventory.changed"
      || eventType === "maintenance.completed"
      || eventType === "hobby.session-progress";
  }

  if (pathname === "/inventory" || pathname.startsWith("/inventory/")) {
    return eventType === "inventory.changed";
  }

  if (pathname.startsWith("/assets/")) {
    return eventType === "asset.updated" || eventType === "maintenance.completed";
  }

  return false;
};

export function RealtimeSyncProvider({ householdId, children }: RealtimeSyncProviderProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastRefreshAtRef = useRef(0);
  const activeHouseholdId = searchParams.get("householdId") ?? householdId;

  const { connectionState } = useRealtimeUpdates({
    householdId: activeHouseholdId,
    enabled: Boolean(activeHouseholdId),
    onEvent: (event) => {
      if (process.env.NODE_ENV === "development") {
        return;
      }

      if (!shouldRefreshForPath(pathname, event.type)) {
        return;
      }

      const now = Date.now();

      if (now - lastRefreshAtRef.current < AUTO_REFRESH_THROTTLE_MS) {
        return;
      }

      lastRefreshAtRef.current = now;
      startTransition(() => {
        router.refresh();
      });
    }
  });

  const value = useMemo<RealtimeContextValue>(() => ({ connectionState }), [connectionState]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeConnectionState(): RealtimeConnectionState {
  return useContext(RealtimeContext).connectionState;
}
