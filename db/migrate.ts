import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Database } from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type * as schema from "./schema";

type DrizzleDb = BetterSQLite3Database<typeof schema>;

const PRISMA_MIGRATIONS_COVERED_BY_BASELINE = [
  "20250209232309_init",
  "20250223171054_add_steam",
  "20250223174407_steam_want_bigint",
  "20250223180741_steam_game_fields",
  "20250223182214_add_playtime_table",
  "20250223185516_add_timestamp_start",
  "20250307210320_game_states",
  "20250307213029_game_states_allow_null",
  "20250308181708_steam_app_info",
  "20250327231353_gog_user",
  "20250329000248_gog_game",
];

const FINAL_PRISMA_MIGRATION = "20260830020956_gog_playtime";

export function migrationsFolder() {
  return join(process.cwd(), "db", "migrations");
}

function adoptSqlPath(migrationName: string) {
  return join(process.cwd(), "db", "adopt", `${migrationName}.sql`);
}

function tableExists(sqlite: Database, name: string) {
  const row = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
  return row !== undefined;
}

function drizzleMigrationCount(sqlite: Database) {
  if (!tableExists(sqlite, "__drizzle_migrations")) return 0;
  const [count] = sqlite
    .prepare("SELECT count(*) FROM __drizzle_migrations")
    .raw()
    .get() as [number | bigint];
  return Number(count);
}

function appliedPrismaMigrations(sqlite: Database) {
  const rows = sqlite
    .prepare(
      `SELECT migration_name FROM _prisma_migrations
       WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    )
    .raw()
    .all() as [string][];
  return new Set(rows.map(([name]) => name));
}

function recordPrismaMigration(
  sqlite: Database,
  migrationName: string,
  sql: string,
) {
  const now = Date.now();
  sqlite
    .prepare(
      `INSERT INTO _prisma_migrations
       (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
    )
    .run(
      randomUUID(),
      createHash("sha256").update(sql).digest("hex"),
      now,
      migrationName,
      now,
    );
}

function recordDrizzleBaseline(sqlite: Database, folder: string) {
  const [baseline] = readMigrationFiles({ migrationsFolder: folder });
  if (!baseline) throw new Error(`No Drizzle migrations found in ${folder}`);
  sqlite.exec(
    `CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
       id SERIAL PRIMARY KEY,
       hash text NOT NULL,
       created_at numeric
     )`,
  );
  sqlite
    .prepare(
      `INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)`,
    )
    .run(baseline.hash, baseline.folderMillis);
}

function adoptPrismaDatabase(sqlite: Database, folder: string) {
  const applied = appliedPrismaMigrations(sqlite);
  const missing = PRISMA_MIGRATIONS_COVERED_BY_BASELINE.filter(
    (name) => !applied.has(name),
  );
  if (missing.length > 0) {
    throw new Error(
      `Database is too old to adopt: Prisma migrations not applied: ${missing.join(", ")}. ` +
        `Upgrade with the previous release first (pnpm prisma migrate deploy), then retry.`,
    );
  }

  if (!applied.has(FINAL_PRISMA_MIGRATION)) {
    // Toggling PRAGMA foreign_keys is a no-op inside a transaction, so this
    // last Prisma migration has to run on its own.
    const sql = readFileSync(adoptSqlPath(FINAL_PRISMA_MIGRATION), "utf8");
    sqlite.exec(sql);
    recordPrismaMigration(sqlite, FINAL_PRISMA_MIGRATION, sql);
  }

  recordDrizzleBaseline(sqlite, folder);
}

export function runMigrations(sqlite: Database, db: DrizzleDb) {
  const folder = migrationsFolder();
  if (
    drizzleMigrationCount(sqlite) === 0 &&
    tableExists(sqlite, "_prisma_migrations")
  ) {
    adoptPrismaDatabase(sqlite, folder);
  }
  migrate(db, { migrationsFolder: folder });
}
