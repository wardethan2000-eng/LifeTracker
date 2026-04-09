import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  flushMutations,
  getPendingCount,
  getFailedCount,
  getFailedMutations,
  retryMutation,
  discardMutation,
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
  failedMutations: QueuedMutation[];
  /** Mark a failed mutation as pending again so it will be retried on next flush */
  retry: (id: string) => void;
  /** Remove a failed mutation from the queue permanently */
  discard: (id: string) => void;
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
  const [failedMutations, setFailedMutations] = useState<QueuedMutation[]>(
    () => getFailedMutations()
  );
  const [isFlushing, setIsFlushing] = useState(false);
  const wasOfflineRef = useRef(false);

  const refreshCounts = useCallback(() => {
    setPendingCount(getPendingCount());
    setFailedCount(getFailedCount());
    setFailedMutations(getFailedMutations());
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

  const retry = useCallback((id: string) => {
    retryMutation(id);
    refreshCounts();
  }, [refreshCounts]);

  const discard = useCallback((id: string) => {
    discardMutation(id);
    refreshCounts();
  }, [refreshCounts]);

  return { isOnline, pendingCount, failedCount, failedMutations, retry, discard, isFlushing };
}
