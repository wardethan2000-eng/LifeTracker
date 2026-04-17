/**
 * StorageMode abstraction — routes reads to PGlite (local) or the remote API.
 *
 * StorageModeContext
 * ------------------
 * A React context that advertises whether the local PGlite snapshot has been
 * loaded for the current household.  Components and hooks consume this to
 * decide where to read data from.
 *
 * useDataQuery
 * ------------
 * A thin wrapper around React Query's `useQuery`.  It accepts two `queryFn`
 * implementations — one for local reads and one for remote reads — and picks
 * the right one based on the current `StorageMode`.
 *
 *   const { data } = useDataQuery({
 *     queryKey: ["assets", householdId],
 *     localFn: () => readSnapshot<Asset>(householdId, "assets"),
 *     remoteFn: () => apiRequest<Asset[]>(`/v1/households/${householdId}/assets`),
 *   });
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode
} from "react";
import { useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";

// ─── StorageMode ─────────────────────────────────────────────────────────────

export type StorageMode = "local" | "remote";

interface StorageModeContextValue {
  mode: StorageMode;
  /** Call after the PGlite snapshot has been populated to switch to local reads. */
  setMode: (mode: StorageMode) => void;
}

const StorageModeContext = createContext<StorageModeContextValue>({
  mode: "remote",
  setMode: () => {}
});

export interface StorageModeProviderProps {
  children: ReactNode;
  /** Override the initial mode (useful in tests). Default: "remote". */
  initialMode?: StorageMode;
}

export function StorageModeProvider({
  children,
  initialMode = "remote"
}: StorageModeProviderProps): ReactNode {
  const [mode, setModeState] = useState<StorageMode>(initialMode);
  const setMode = useCallback((next: StorageMode) => setModeState(next), []);
  return (
    <StorageModeContext.Provider value={{ mode, setMode }}>
      {children}
    </StorageModeContext.Provider>
  );
}

export const useStorageMode = (): StorageModeContextValue =>
  useContext(StorageModeContext);

// ─── useDataQuery ─────────────────────────────────────────────────────────────

type DataQueryOptions<TData> = Omit<
  UseQueryOptions<TData, Error>,
  "queryFn"
> & {
  /**
   * Called when `mode === "local"`.  Should read from PGlite via
   * `readSnapshot()`.  May return `null` to signal that the local cache is
   * not yet populated — the hook will fall back to `remoteFn` automatically.
   */
  localFn: () => Promise<TData | null>;
  /** Called when `mode === "remote"` or when `localFn` returns `null`. */
  remoteFn: () => Promise<TData>;
};

export function useDataQuery<TData>({
  localFn,
  remoteFn,
  ...options
}: DataQueryOptions<TData>): UseQueryResult<TData, Error> {
  const { mode } = useStorageMode();

  return useQuery<TData, Error>({
    ...options,
    queryFn: async () => {
      if (mode === "local") {
        const local = await localFn();
        if (local !== null) return local;
        // Local cache miss — fall through to remote
      }
      return remoteFn();
    }
  });
}
