/**
 * SPEC: database-schema
 * Singleton lifecycle management for the database.
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils/logger";
import type { DbHandle } from "./db";
import { openDatabase, initSchema, closeDatabase } from "./db";

const COMMANDTREE_DIR = ".commandtree";
const DB_FILENAME = "commandtree.sqlite3";

let dbHandle: DbHandle | null = null;

/**
 * Initialises the SQLite database singleton.
 * Re-creates if the DB file was deleted externally.
 */
export function initDb(workspaceRoot: string): DbHandle {
  if (dbHandle !== null && fs.existsSync(dbHandle.path)) {
    return dbHandle;
  }
  resetStaleHandle();

  const dbDir = path.join(workspaceRoot, COMMANDTREE_DIR);
  fs.mkdirSync(dbDir, { recursive: true });

  const dbPath = path.join(dbDir, DB_FILENAME);
  const openResult = openDatabase(dbPath);
  if (!openResult.ok) {
    throw new Error(openResult.error);
  }

  initSchema(openResult.value);
  dbHandle = openResult.value;
  logger.info("SQLite database initialised", { path: dbPath });
  return dbHandle;
}

/**
 * Returns the current database handle.
 * Throws if the database has not been initialised.
 */
export function getDb(): DbHandle {
  if (dbHandle !== null && fs.existsSync(dbHandle.path)) {
    return dbHandle;
  }
  resetStaleHandle();
  throw new Error("Database not initialised. Call initDb first.");
}

function resetStaleHandle(): void {
  if (dbHandle !== null) {
    closeDatabase(dbHandle);
    dbHandle = null;
  }
}

/**
 * Disposes the database connection.
 */
export function disposeDb(): void {
  const currentDb = dbHandle;
  dbHandle = null;
  if (currentDb !== null) {
    closeDatabase(currentDb);
  }
  logger.info("Database disposed");
}
