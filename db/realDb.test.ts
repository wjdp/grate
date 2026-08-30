import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { runMigrations } from "~~/db/migrate";
import { createDb } from "~~/lib/db";

// Opt-in check against a copy of a real database, which is never committed:
// GRATE_REAL_DB=tmp/will.sqlite pnpm vitest run db/
const realDb = process.env.GRATE_REAL_DB;

const FINAL_PRISMA_MIGRATION_SQL = readFileSync(
  join(process.cwd(), "db/adopt/20260830020956_gog_playtime.sql"),
  "utf8",
);

function copyOf(source: string, name: string) {
  const path = join(mkdtempSync(join(tmpdir(), "grate-real-")), name);
  copyFileSync(source, path);
  return path;
}

function schemaOf(path: string) {
  const sqlite = new Database(path);
  const statements = sqlite
    .prepare(
      `SELECT sql FROM sqlite_master
       WHERE sql IS NOT NULL
         AND name NOT IN ('_prisma_migrations', '__drizzle_migrations')
         AND name NOT LIKE 'sqlite_%'`,
    )
    .raw()
    .all() as [string][];
  sqlite.close();
  return statements
    .map(([sql]) => sql.replaceAll(/["`]/g, "").replaceAll(/\s+/g, " ").trim())
    .sort();
}

function rowCounts(path: string) {
  const sqlite = new Database(path);
  const tables = (
    sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
         AND name NOT IN ('_prisma_migrations', '__drizzle_migrations')`,
      )
      .raw()
      .all() as [string][]
  ).map(([name]) => name);
  const counts = Object.fromEntries(
    tables.map((table) => [
      table,
      (
        sqlite.prepare(`SELECT count(*) FROM "${table}"`).raw().get() as [
          number,
        ]
      )[0],
    ]),
  );
  sqlite.close();
  return counts;
}

describe.skipIf(!realDb)("adoption of a real database", () => {
  it("matches the schema Prisma would produce and keeps every row", () => {
    const source = join(process.cwd(), realDb!);
    const before = rowCounts(source);

    const reference = copyOf(source, "reference.sqlite");
    const referenceSqlite = new Database(reference);
    referenceSqlite.exec(FINAL_PRISMA_MIGRATION_SQL);
    referenceSqlite.close();

    const adopted = copyOf(source, "adopted.sqlite");
    const { db, sqlite } = createDb(adopted);
    runMigrations(sqlite, db);

    expect(schemaOf(adopted)).toEqual(schemaOf(reference));
    expect(rowCounts(adopted)).toEqual({
      ...before,
      GogGamePlaytime: 0,
      GogIgnoredProduct: 0,
    });
    expect(
      sqlite.prepare(`SELECT count(*) FROM _prisma_migrations`).raw().get(),
    ).toEqual([12n]);
    expect(
      sqlite.prepare(`SELECT count(*) FROM __drizzle_migrations`).raw().get(),
    ).toEqual([1n]);

    const schemaAfterFirstRun = schemaOf(adopted);
    runMigrations(sqlite, db);
    expect(schemaOf(adopted)).toEqual(schemaAfterFirstRun);
    expect(rowCounts(adopted)).toEqual({
      ...before,
      GogGamePlaytime: 0,
      GogIgnoredProduct: 0,
    });
    sqlite.close();
  });
});
