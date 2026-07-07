import "server-only";

import { PGlite } from "@electric-sql/pglite";
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";

declare global {
  var asuntiaDatabase: Promise<PGlite> | undefined;
  var asuntiaMigrations: Promise<void> | undefined;
  var asuntiaDatabaseShutdownRegistered: boolean | undefined;
}

const DEFAULT_DATABASE_DIR = ".asuntia/pglite";
const MIGRATIONS_DIR = "supabase/migrations";

function databasePath() {
  return process.env.ASUNTIA_LOCAL_DB_PATH ?? path.join(process.cwd(), DEFAULT_DATABASE_DIR);
}

function registerShutdown() {
  if (globalThis.asuntiaDatabaseShutdownRegistered) {
    return;
  }

  globalThis.asuntiaDatabaseShutdownRegistered = true;

  async function shutdown() {
    try {
      const db = await globalThis.asuntiaDatabase;
      await db?.close();
    } finally {
      process.exit(0);
    }
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

async function runMigrations(db: PGlite) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const migrationsPath = path.join(process.cwd(), MIGRATIONS_DIR);
  const migrationFiles = (await readdir(migrationsPath))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const version = file.replace(/\.sql$/, "");
    const existing = await db.query<{ version: string }>(
      "SELECT version FROM schema_migrations WHERE version = $1",
      [version],
    );

    if (existing.rows.length > 0) {
      continue;
    }

    const sql = await readFile(path.join(migrationsPath, file), "utf8");
    await db.exec("BEGIN");
    try {
      await db.exec(sql);
      await db.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await db.exec("COMMIT");
    } catch (error) {
      await db.exec("ROLLBACK");
      throw error;
    }
  }
}

export async function getDatabase() {
  registerShutdown();
  globalThis.asuntiaDatabase ??= (async () => {
    const dbPath = databasePath();
    await mkdir(path.dirname(dbPath), { recursive: true });
    return new PGlite(dbPath);
  })();
  const db = await globalThis.asuntiaDatabase;

  globalThis.asuntiaMigrations ??= runMigrations(db);
  await globalThis.asuntiaMigrations;

  return db;
}
