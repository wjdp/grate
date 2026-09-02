import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { createDb } from "~~/server/database/client";
import { describeMigrations, runMigrations } from "~~/server/database/migrate";

const TABLES = [
  "User",
  "SteamUser",
  "GogUser",
  "Game",
  "GameStateChange",
  "GameDistinctPair",
  "SteamGame",
  "SteamAppInfo",
  "SteamGamePlaytime",
  "SteamPicsMetadata",
  "SteamTag",
  "GogGame",
  "GogGamePlaytime",
  "GogIgnoredProduct",
  "EpicUser",
  "EpicGame",
  "EpicGamePlaytime",
  "EpicIgnoredItem",
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

function temporaryPath(name: string) {
  return join(mkdtempSync(join(tmpdir(), "grate-migrate-")), name);
}

function withSqlite<T>(path: string, read: (sqlite: Database.Database) => T) {
  const sqlite = new Database(path);
  try {
    return read(sqlite);
  } finally {
    sqlite.close();
  }
}

function schemaOf(path: string) {
  return withSqlite(path, (sqlite) =>
    (
      sqlite
        .prepare(
          `SELECT sql FROM sqlite_master
           WHERE sql IS NOT NULL
             AND name NOT IN ('__drizzle_migrations')
             AND name NOT LIKE 'sqlite_%'`,
        )
        .raw()
        .all() as [string][]
    )
      .map(([sql]) =>
        sql.replaceAll(/["`]/g, "").replaceAll(/\s+/g, " ").trim(),
      )
      .sort(),
  );
}

function rowCounts(path: string) {
  return withSqlite(path, (sqlite) =>
    Object.fromEntries(
      TABLES.map((table) => [
        table,
        (
          sqlite.prepare(`SELECT count(*) FROM "${table}"`).raw().get() as [
            number,
          ]
        )[0],
      ]),
    ),
  );
}

function drizzleMigrationCount(path: string) {
  return withSqlite(
    path,
    (sqlite) =>
      (
        sqlite
          .prepare(`SELECT count(*) FROM __drizzle_migrations`)
          .raw()
          .get() as [number]
      )[0],
  );
}

describe("runMigrations", () => {
  it("creates every table on a fresh database", () => {
    const { db, sqlite } = open(":memory:");
    const report = runMigrations(sqlite, db);

    expect(report.total).toBe(11);
    expect(report.applied).toHaveLength(11);
    expect(report.applied[0]).toBe("0000_baseline");

    const tables = (
      sqlite
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
        .raw()
        .all() as [string][]
    ).map(([name]) => name);
    for (const table of TABLES) expect(tables).toContain(table);
    expect(
      sqlite.prepare(`SELECT count(*) FROM __drizzle_migrations`).raw().get(),
    ).toEqual([11]);
  });

  it("is a no-op when run again", () => {
    const path = temporaryPath("twice.sqlite");
    const { db, sqlite } = open(path);
    runMigrations(sqlite, db);
    const schema = schemaOf(path);
    const counts = rowCounts(path);

    const report = runMigrations(sqlite, db);

    expect(report).toMatchObject({ applied: [], total: 11 });
    expect(schemaOf(path)).toEqual(schema);
    expect(rowCounts(path)).toEqual(counts);
    expect(drizzleMigrationCount(path)).toBe(11);
  });
});

describe("describeMigrations", () => {
  it("reports an up-to-date database on one line", () => {
    expect(
      describeMigrations(
        { applied: [], total: 11, durationMs: 1 },
        "/data/grate.db",
      ),
    ).toBe(
      "Database up to date, 11 migrations already applied (/data/grate.db)",
    );
  });

  it("lists each applied migration", () => {
    expect(
      describeMigrations(
        {
          applied: ["0009_game_hidden", "0010_next"],
          total: 11,
          durationMs: 42,
        },
        "/data/grate.db",
      ),
    ).toBe(
      [
        "Database migrated, applied 2 new migrations in 42ms, 11 total (/data/grate.db)",
        "  ✔ 0009_game_hidden",
        "  ✔ 0010_next",
      ].join("\n"),
    );
  });
});
