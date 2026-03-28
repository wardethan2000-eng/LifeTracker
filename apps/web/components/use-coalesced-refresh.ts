"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef } from "react";

const DEFAULT_COALESCE_MS = 1200;

export function useCoalescedRefresh(coalesceMs: number = DEFAULT_COALESCE_MS): () => void {
  const router = useRouter();
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
  }, []);

  return useCallback(() => {
    if (timerRef.current !== null) {
      return;
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      startTransition(() => {
        router.refresh();
      });
    }, coalesceMs);
  }, [coalesceMs, router]);
}
