import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { runMigrations } from "~~/db/migrate";
import { createDb } from "~~/lib/db";

const FIXTURE = join(process.cwd(), "test/fixtures/prisma-at-gog_game.sqlite");
const FINAL_PRISMA_MIGRATION = "20260830020956_gog_playtime";
const FINAL_PRISMA_MIGRATION_SQL = readFileSync(
  join(process.cwd(), "db/adopt", `${FINAL_PRISMA_MIGRATION}.sql`),
  "utf8",
);

const TABLES = [
  "User",
  "SteamUser",
  "GogUser",
  "Game",
  "GameStateChange",
  "SteamGame",
  "SteamAppInfo",
  "SteamGamePlaytime",
  "GogGame",
  "GogGamePlaytime",
  "GogIgnoredProduct",
];

const openConnections: Database.Database[] = [];

function open(path: string) {
  const connection = createDb(path);
  openConnections.push(connection.sqlite);
  return connection;
}

afterEach(() => {
  while (openConnections.length > 0) openConnections.pop()?.close();
});

function workingCopy(name: string) {
  const path = join(mkdtempSync(join(tmpdir(), "grate-migrate-")), name);
  copyFileSync(FIXTURE, path);
  return path;
}

function fixtureAtPrismaHead() {
  const path = workingCopy("head.sqlite");
  const sqlite = new Database(path);
  sqlite.exec(FINAL_PRISMA_MIGRATION_SQL);
  sqlite
    .prepare(
      `INSERT INTO _prisma_migrations
       (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES ('fixture-head', ?, ?, ?, NULL, NULL, ?, 1)`,
    )
    .run(
      createHash("sha256").update(FINAL_PRISMA_MIGRATION_SQL).digest("hex"),
      Date.now(),
      FINAL_PRISMA_MIGRATION,
      Date.now(),
    );
  sqlite.close();
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
  const counts = Object.fromEntries(
    TABLES.filter(
      (table) =>
        sqlite
          .prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
          )
          .get(table) !== undefined,
    ).map((table) => [
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

describe("runMigrations", () => {
  it("creates every table on a fresh database", () => {
    const { db, sqlite } = open(":memory:");
    runMigrations(sqlite, db);

    const tables = (
      sqlite
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
        .raw()
        .all() as [string][]
    ).map(([name]) => name);
    for (const table of TABLES) expect(tables).toContain(table);
    expect(
      sqlite.prepare(`SELECT count(*) FROM __drizzle_migrations`).raw().get(),
    ).toEqual([1n]);
    expect(tables).not.toContain("_prisma_migrations");
  });

  it("adopts a Prisma database that is one migration behind", () => {
    const path = workingCopy("behind.sqlite");
    const before = rowCounts(path);
    const reference = fixtureAtPrismaHead();

    const { db, sqlite } = open(path);
    runMigrations(sqlite, db);

    expect(schemaOf(path)).toEqual(schemaOf(reference));

    const migrations = sqlite
      .prepare(
        `SELECT migration_name, checksum FROM _prisma_migrations ORDER BY started_at`,
      )
      .raw()
      .all() as [string, string][];
    expect(migrations).toHaveLength(12);
    expect(migrations.at(-1)).toEqual([
      FINAL_PRISMA_MIGRATION,
      createHash("sha256").update(FINAL_PRISMA_MIGRATION_SQL).digest("hex"),
    ]);
    expect(
      sqlite.prepare(`SELECT count(*) FROM __drizzle_migrations`).raw().get(),
    ).toEqual([1n]);

    const backfilled = sqlite
      .prepare(
        `SELECT g."playtimeMinutes", g."lastPlayedAt", s."playtimeForever"
         FROM "Game" g JOIN "SteamGame" s ON s."gameId" = g."id" ORDER BY g."id"`,
      )
      .raw()
      .all() as [number | bigint, string | null, number | bigint][];
    expect(backfilled.map(([minutes]) => Number(minutes))).toEqual([
      1200, 0, 45,
    ]);
    expect(backfilled[0]![1]).toBe("2025-03-24T01:00:00.000Z");
    expect(backfilled[1]![1]).toBeNull();

    expect(rowCounts(path)).toEqual({
      ...before,
      GogGamePlaytime: 0,
      GogIgnoredProduct: 0,
    });
  });

  it("only marks the baseline when the Prisma database is already at head", () => {
    const path = fixtureAtPrismaHead();
    const before = rowCounts(path);

    const { db, sqlite } = open(path);
    runMigrations(sqlite, db);

    expect(
      sqlite.prepare(`SELECT count(*) FROM _prisma_migrations`).raw().get(),
    ).toEqual([12n]);
    expect(
      sqlite.prepare(`SELECT count(*) FROM __drizzle_migrations`).raw().get(),
    ).toEqual([1n]);
    expect(rowCounts(path)).toEqual(before);
  });

  it("refuses a database that predates the adoption baseline", () => {
    const path = workingCopy("too-old.sqlite");
    const sqlite = new Database(path);
    sqlite
      .prepare(`DELETE FROM _prisma_migrations WHERE migration_name = ?`)
      .run("20250329000248_gog_game");
    sqlite.close();

    const { db, sqlite: connection } = open(path);
    expect(() => runMigrations(connection, db)).toThrow(
      /too old to adopt.*20250329000248_gog_game/s,
    );
  });

  it("is a no-op when run again", () => {
    const path = workingCopy("twice.sqlite");
    const { db, sqlite } = open(path);
    runMigrations(sqlite, db);
    const schema = schemaOf(path);
    const counts = rowCounts(path);

    runMigrations(sqlite, db);

    expect(schemaOf(path)).toEqual(schema);
    expect(rowCounts(path)).toEqual(counts);
    expect(
      sqlite.prepare(`SELECT count(*) FROM _prisma_migrations`).raw().get(),
    ).toEqual([12n]);
    expect(
      sqlite.prepare(`SELECT count(*) FROM __drizzle_migrations`).raw().get(),
    ).toEqual([1n]);
  });
});
