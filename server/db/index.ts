import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { migrations } from "./migrations";
import { mkdirSync, existsSync } from "fs";
import { resolveDataDir } from "../data-dir";

const DB_DIR = resolveDataDir();
const DB_PATH = `${DB_DIR}/forza-telemetry.db`;

// Ensure data directory exists
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

const sqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrent read/write performance
sqlite.exec("PRAGMA journal_mode = WAL");
sqlite.exec("PRAGMA foreign_keys = ON");
// Wait up to 5s when another process holds the write lock (e.g. during hot-reload)
sqlite.exec("PRAGMA busy_timeout = 5000");

// ── Migration system ────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

function runMigrations() {
  const applied = new Set(
    (sqlite.query("SELECT version FROM schema_migrations").all() as { version: number }[]).map((r) => r.version)
  );
  const pending = migrations.filter((m) => !applied.has(m.version)).sort((a, b) => a.version - b.version);

  if (pending.length === 0) return;

  console.log(`[DB] Running ${pending.length} migration(s)...`);

  for (const migration of pending) {
    console.log(`[DB]   v${migration.version}: ${migration.name}`);
    sqlite.exec("BEGIN");
    try {
      for (const sql of migration.sql) {
        sqlite.exec(sql);
      }
      sqlite.prepare("INSERT INTO schema_migrations (version, name) VALUES (?, ?)").run(migration.version, migration.name);
      sqlite.exec("COMMIT");
    } catch (err) {
      sqlite.exec("ROLLBACK");
      throw err;
    }
  }

  console.log(`[DB] Migrations complete.`);
}

runMigrations();

// Seed default profile if none exist
const profileCount = sqlite.query("SELECT COUNT(*) as c FROM profiles").get() as { c: number };
if (profileCount.c === 0) {
  sqlite.exec("INSERT INTO profiles (name) VALUES ('Driver 1')");
}
// Backfill any laps that have no profile assigned
sqlite.exec("UPDATE laps SET profile_id = (SELECT id FROM profiles ORDER BY id LIMIT 1) WHERE profile_id IS NULL");

export const db = drizzle(sqlite, { schema });
export { sqlite };




