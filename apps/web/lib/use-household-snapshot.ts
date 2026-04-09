/**
 * useHouseholdSnapshot
 *
 * On first call for a given household, fetches the full bulk-export JSON from
 * the server and writes every section into the local PGlite snapshot cache.
 * Once the load completes, it flips `StorageModeContext` to `"local"` so that
 * subsequent `useDataQuery` calls read from PGlite instead of the network.
 *
 * The hook is idempotent: if the snapshot was loaded in the same browser
 * session it does nothing.  Pass `{ force: true }` to re-fetch.
 *
 * Usage
 * -----
 *   // In a layout or page that wraps authenticated content:
 *   useHouseholdSnapshot(householdId);
 */

"use client";

import { useEffect, useRef } from "react";
import { writeSnapshot, clearSnapshot } from "./pglite-client";
import { useStorageMode } from "./data-access";

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes — matches analytics ISR window

interface SnapshotOptions {
  /** Force a re-fetch even if the local cache is fresh. */
  force?: boolean;
  /**
   * Base URL for the API.  Defaults to NEXT_PUBLIC_LIFEKEEPER_API_BASE_URL or
   * http://localhost:4000.
   */
  apiBaseUrl?: string;
}

// Track which household IDs have already been loaded in this session so we
// don't fire multiple concurrent fetches from sibling components.
const loadedHouseholds = new Set<string>();
const inFlightHouseholds = new Set<string>();

export function useHouseholdSnapshot(
  householdId: string | undefined,
  options: SnapshotOptions = {}
): void {
  const { setMode } = useStorageMode();
  const lastLoadedRef = useRef<number>(0);

  useEffect(() => {
    if (!householdId) return;
    if (typeof window === "undefined") return;

    const isLoaded = loadedHouseholds.has(householdId);
    const isFresh = Date.now() - lastLoadedRef.current < CACHE_TTL_MS;
    if (isLoaded && isFresh && !options.force) return;
    if (inFlightHouseholds.has(householdId)) return;

    const apiBase =
      options.apiBaseUrl ??
      process.env.NEXT_PUBLIC_LIFEKEEPER_API_BASE_URL ??
      "http://localhost:4000";

    inFlightHouseholds.add(householdId);

    const loadSnapshot = async (): Promise<void> => {
      try {
        const response = await fetch(
          `${apiBase}/v1/households/${householdId}/export/json`,
          { credentials: "include" }
        );
        if (!response.ok) {
          console.warn(
            `[pglite] snapshot fetch failed: ${response.status} ${response.statusText}`
          );
          return;
        }

        const data = (await response.json()) as {
          sections: Record<string, unknown[]>;
        };

        // Clear stale data before writing fresh sections
        await clearSnapshot(householdId);

        await Promise.all(
          Object.entries(data.sections).map(([entityType, records]) =>
            writeSnapshot(householdId, entityType, records)
          )
        );

        loadedHouseholds.add(householdId);
        lastLoadedRef.current = Date.now();
        setMode("local");
      } catch (err) {
        // Non-fatal: fall back to remote reads silently
        console.warn("[pglite] snapshot load error:", err);
      } finally {
        inFlightHouseholds.delete(householdId);
      }
    };

    void loadSnapshot();
  }, [householdId, options.force, options.apiBaseUrl, setMode]);
}
