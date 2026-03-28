import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  flushMutations,
  getPendingCount,
  getFailedCount,
  type QueuedMutation,
} from "../lib/offline-queue";
import { apiRequest } from "../lib/api";
import { z } from "zod";
import { queryClient } from "../lib/query-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
  isFlushing: boolean;
}

// ---------------------------------------------------------------------------
// Queue executor — sends a QueuedMutation over the network
// ---------------------------------------------------------------------------

const unknownSchema = z.unknown();

async function executeMutation(mutation: QueuedMutation): Promise<void> {
  await apiRequest(mutation.path, unknownSchema, {
    method: mutation.method,
    body: mutation.body,
  });
  // Invalidate related query cache so lists refresh
  await queryClient.invalidateQueries({ queryKey: [mutation.entityType] });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Monitors network connectivity and flushes the offline mutation queue when
 * connectivity is restored. Returns current online state and queue counts.
 */
export function useOfflineSync(): OfflineSyncState {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(() => getPendingCount());
  const [failedCount, setFailedCount] = useState(() => getFailedCount());
  const [isFlushing, setIsFlushing] = useState(false);
  const wasOfflineRef = useRef(false);

  const refreshCounts = useCallback(() => {
    setPendingCount(getPendingCount());
    setFailedCount(getFailedCount());
  }, []);

  const flush = useCallback(async () => {
    if (isFlushing) return;
    setIsFlushing(true);
    try {
      await flushMutations(executeMutation);
    } finally {
      setIsFlushing(false);
      refreshCounts();
    }
  }, [isFlushing, refreshCounts]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);

      // Flush the queue when we transition from offline → online
      if (online && wasOfflineRef.current) {
        void flush();
      }
      wasOfflineRef.current = !online;
    });

    // Initial connectivity fetch
    void NetInfo.fetch().then((state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      wasOfflineRef.current = !online;
    });

    return unsubscribe;
  }, [flush]);

  // Keep counts fresh after each flush
  useEffect(() => {
    if (!isFlushing) refreshCounts();
  }, [isFlushing, refreshCounts]);

  return { isOnline, pendingCount, failedCount, isFlushing };
}
