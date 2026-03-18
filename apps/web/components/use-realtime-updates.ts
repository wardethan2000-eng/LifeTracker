"use client";

import { useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "../lib/api";
import type { RealtimeEvent, RealtimeEventType } from "../lib/realtime-events";

export type RealtimeConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "paused" | "disconnected";

type UseRealtimeUpdatesOptions = {
  householdId: string | null;
  eventTypes?: RealtimeEventType[];
  enabled?: boolean;
  onEvent?: (event: RealtimeEvent) => void;
};

export function useRealtimeUpdates({ householdId, eventTypes, enabled = true, onEvent }: UseRealtimeUpdatesOptions): {
  connectionState: RealtimeConnectionState;
  lastEvent: RealtimeEvent | null;
} {
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>(enabled ? "connecting" : "idle");
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const onEventRef = useRef(onEvent);
  const isVisibleRef = useRef(true);

  onEventRef.current = onEvent;

  useEffect(() => {
    if (typeof document !== "undefined") {
      isVisibleRef.current = document.visibilityState === "visible";
    }
  }, []);

  useEffect(() => {
    if (!enabled || !householdId || typeof window === "undefined") {
      setConnectionState(enabled ? "idle" : "disconnected");
      return;
    }

    const clearReconnectTimer = (): void => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const disconnect = (nextState: RealtimeConnectionState): void => {
      clearReconnectTimer();

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      setConnectionState(nextState);
    };

    const connect = (): void => {
      clearReconnectTimer();

      if (!isVisibleRef.current) {
        disconnect("paused");
        return;
      }

      setConnectionState(reconnectAttemptsRef.current > 0 ? "reconnecting" : "connecting");
      const source = new EventSource(`/api/realtime?householdId=${encodeURIComponent(householdId)}`);
      eventSourceRef.current = source;

      source.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setConnectionState("connected");
      };

      source.onmessage = (message) => {
        try {
          const nextEvent = JSON.parse(message.data) as RealtimeEvent;

          if (eventTypes && eventTypes.length > 0 && !eventTypes.includes(nextEvent.type)) {
            return;
          }

          setLastEvent(nextEvent);
          onEventRef.current?.(nextEvent);
        } catch {
          // Ignore malformed events.
        }
      };

      source.onerror = () => {
        source.close();
        eventSourceRef.current = null;

        if (!enabled || !isVisibleRef.current) {
          setConnectionState("paused");
          return;
        }

        reconnectAttemptsRef.current += 1;
        const backoffMs = Math.min(30000, 1000 * 2 ** Math.min(reconnectAttemptsRef.current, 5));
        setConnectionState("reconnecting");
        reconnectTimerRef.current = window.setTimeout(connect, backoffMs);
      };
    };

    const handleVisibilityChange = (): void => {
      isVisibleRef.current = document.visibilityState === "visible";

      if (!isVisibleRef.current) {
        disconnect("paused");
        return;
      }

      if (!eventSourceRef.current) {
        connect();
      }
    };

    connect();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      disconnect("disconnected");
    };
  }, [enabled, eventTypes, householdId]);

  return { connectionState, lastEvent };
}