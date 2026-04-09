/**
 * PGlite Web Worker entry point.
 *
 * This module runs inside a dedicated Web Worker. It initialises a PGlite
 * (Postgres-in-WASM) instance and registers it with the `worker()` helper so
 * that the main thread can communicate with it via `PGliteWorker.create()`.
 *
 * Schema
 * ------
 * A single `snapshot` table stores one row per entity type per household.
 * The `payload` column holds a JSON-serialised array of records returned by
 * the server's bulk-export endpoint.  The `loaded_at` column is used by the
 * client to decide whether the cache is fresh enough to use.
 */

import { PGlite } from "@electric-sql/pglite";
import { worker } from "@electric-sql/pglite/worker";

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS snapshot (
    household_id TEXT NOT NULL,
    entity_type  TEXT NOT NULL,
    payload      TEXT NOT NULL DEFAULT '[]',
    loaded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (household_id, entity_type)
  );
`;

worker({
  init: async () => {
    const db = new PGlite();
    await db.exec(SCHEMA_SQL);
    return db;
  }
});
