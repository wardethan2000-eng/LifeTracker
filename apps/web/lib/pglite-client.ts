/**
 * PGlite main-thread client singleton.
 *
 * Lazily creates a `PGliteWorker` that communicates with `pglite.worker.ts`
 * running in a dedicated Web Worker.  All subsequent calls re-use the same
 * instance for the lifetime of the page.
 *
 * Usage
 * -----
 *   import { getPgliteClient } from "@/lib/pglite-client";
 *
 *   const db = await getPgliteClient();
 *   const rows = await db.query<{ payload: string }>(
 *     "SELECT payload FROM snapshot WHERE household_id = $1 AND entity_type = $2",
 *     [householdId, "assets"]
 *   );
 */

import type { PGliteWorker } from "@electric-sql/pglite/worker";

let clientPromise: Promise<PGliteWorker> | undefined;

export const getPgliteClient = (): Promise<PGliteWorker> => {
  if (typeof window === "undefined") {
    // Never run in SSR context
    return Promise.reject(new Error("PGlite is not available server-side"));
  }

  if (!clientPromise) {
    clientPromise = (async () => {
      const { PGliteWorker } = await import("@electric-sql/pglite/worker");
      const worker = new Worker(new URL("./pglite.worker.ts", import.meta.url), {
        type: "module"
      });
      return PGliteWorker.create(worker);
    })();
  }

  return clientPromise;
};

/** Write a batch of entities into the local snapshot cache. */
export const writeSnapshot = async (
  householdId: string,
  entityType: string,
  records: unknown[]
): Promise<void> => {
  const db = await getPgliteClient();
  await db.query(
    `INSERT INTO snapshot (household_id, entity_type, payload, loaded_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (household_id, entity_type)
     DO UPDATE SET payload = EXCLUDED.payload, loaded_at = EXCLUDED.loaded_at`,
    [householdId, entityType, JSON.stringify(records)]
  );
};

/** Read a cached entity collection. Returns null if not yet populated. */
export const readSnapshot = async <T = unknown>(
  householdId: string,
  entityType: string
): Promise<T[] | null> => {
  const db = await getPgliteClient();
  const result = await db.query<{ payload: string }>(
    "SELECT payload FROM snapshot WHERE household_id = $1 AND entity_type = $2",
    [householdId, entityType]
  );
  const row = result.rows[0];
  if (!row) return null;
  return JSON.parse(row.payload) as T[];
};

/** How old (in ms) is the locally cached snapshot for a given entity type? */
export const snapshotAge = async (
  householdId: string,
  entityType: string
): Promise<number | null> => {
  const db = await getPgliteClient();
  const result = await db.query<{ loaded_at: string }>(
    "SELECT loaded_at FROM snapshot WHERE household_id = $1 AND entity_type = $2",
    [householdId, entityType]
  );
  const row = result.rows[0];
  if (!row) return null;
  return Date.now() - new Date(row.loaded_at).getTime();
};

/** Remove all cached data for a household (e.g. on sign-out). */
export const clearSnapshot = async (householdId: string): Promise<void> => {
  const db = await getPgliteClient();
  await db.query("DELETE FROM snapshot WHERE household_id = $1", [householdId]);
};
