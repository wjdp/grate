import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { runMigrations } from "~~/db/migrate";
import { createDb } from "~~/lib/db";

// Opt-in check against a copy of a real database, which is never committed:
// GRATE_REAL_DB=tmp/will.sqlite pnpm vitest run db/
const realDb = process.env.GRATE_REAL_DB;

// Every column the schema declares as a timestamp; after 0001 none may hold text.
const DATETIME_COLUMNS: [table: string, column: string][] = [
  ["GogUser", "accessTokenExpiresAt"],
  ["Game", "lastPlayedAt"],
  ["GameStateChange", "timestamp"],
  ["SteamAppInfo", "fetchedAt"],
  ["SteamAppInfo", "releaseDate"],
  ["SteamGamePlaytime", "timestampStart"],
  ["SteamGamePlaytime", "timestampEnd"],
  ["GogGame", "releaseDate"],
  ["GogGame", "lastPlayedAt"],
  ["GogGamePlaytime", "timestampStart"],
  ["GogGamePlaytime", "timestampEnd"],
  ["GogGamePlaytime", "lastPlayedAt"],
  ["GogIgnoredProduct", "createdAt"],
];

const JSON_COLUMNS: [table: string, column: string][] = [
  ["SteamAppInfo", "developers"],
  ["SteamAppInfo", "publishers"],
  ["SteamAppInfo", "categories"],
  ["SteamAppInfo", "genres"],
  ["SteamAppInfo", "screenshots"],
  ["GogGame", "tags"],
  ["GogGame", "properties"],
];

function copyOf(source: string, name: string) {
  const path = join(mkdtempSync(join(tmpdir(), "grate-real-")), name);
  copyFileSync(source, path);
  return path;
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
             AND name NOT IN ('_prisma_migrations', '__drizzle_migrations')
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

function tablesOf(path: string) {
  return withSqlite(
    path,
    (sqlite) =>
      sqlite
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'table'
           AND name NOT LIKE 'sqlite_%'
           AND name NOT IN ('_prisma_migrations', '__drizzle_migrations')`,
        )
        .raw()
        .all() as [string][],
  ).map(([name]) => name);
}

function rowCounts(path: string) {
  return withSqlite(path, (sqlite) =>
    Object.fromEntries(
      tablesOf(path).map((table) => [
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

function storageClasses(path: string, table: string, column: string) {
  return withSqlite(
    path,
    (sqlite) =>
      sqlite
        .prepare(
          `SELECT DISTINCT typeof("${column}") FROM "${table}"
           WHERE "${column}" IS NOT NULL`,
        )
        .raw()
        .all() as [string][],
  ).map(([type]) => type);
}

describe.skipIf(!realDb)("adoption of a real database", () => {
  const source = join(process.cwd(), realDb ?? "");

  it("keeps every row and stores every column natively", () => {
    const before = rowCounts(source);

    const adopted = copyOf(source, "adopted.sqlite");
    const { db, sqlite } = createDb(adopted);
    runMigrations(sqlite, db);

    expect(rowCounts(adopted)).toEqual({
      ...before,
      GogGamePlaytime: 0,
      GogIgnoredProduct: 0,
    });
    expect(
      sqlite.prepare(`SELECT count(*) FROM _prisma_migrations`).raw().get(),
    ).toEqual([12]);
    expect(
      sqlite.prepare(`SELECT count(*) FROM __drizzle_migrations`).raw().get(),
    ).toEqual([2]);
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);

    for (const [table, column] of DATETIME_COLUMNS) {
      expect([table, column, storageClasses(adopted, table, column)]).toEqual([
        table,
        column,
        expect.not.arrayContaining(["text", "real", "blob"]),
      ]);
    }

    for (const [table, column] of JSON_COLUMNS) {
      const values = withSqlite(
        adopted,
        (connection) =>
          connection
            .prepare(`SELECT "${column}" FROM "${table}"`)
            .raw()
            .all() as [string][],
      );
      for (const [value] of values) {
        expect(() => JSON.parse(value) as unknown).not.toThrow();
      }
    }

    const [steamId, steamIdClass] = sqlite
      .prepare(`SELECT "steamId", typeof("steamId") FROM "SteamUser"`)
      .raw()
      .get() as [string, string];
    expect(steamIdClass).toBe("text");
    expect(steamId).toMatch(/^7656\d{13}$/);

    expect(storageClasses(adopted, "SteamGame", "appId")).toEqual(["integer"]);
    expect(storageClasses(adopted, "SteamAppInfo", "appId")).toEqual([
      "integer",
    ]);
    expect(storageClasses(adopted, "SteamGamePlaytime", "steamAppId")).toEqual([
      "integer",
    ]);

    for (const column of [
      "hasCommunityVisibleStats",
      "hasWorkshop",
      "hasDlc",
      "hasLeaderboards",
    ]) {
      const values = withSqlite(
        adopted,
        (connection) =>
          connection
            .prepare(`SELECT DISTINCT "${column}" FROM "SteamGame"`)
            .raw()
            .all() as [number][],
      ).map(([value]) => value);
      expect(values.every((value) => value === 0 || value === 1)).toBe(true);
    }

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

  it("ends up with the schema a fresh install gets", () => {
    const adopted = copyOf(source, "schema.sqlite");
    const adoptedConnection = createDb(adopted);
    runMigrations(adoptedConnection.sqlite, adoptedConnection.db);
    adoptedConnection.sqlite.close();

    const fresh = join(
      mkdtempSync(join(tmpdir(), "grate-fresh-")),
      "new.sqlite",
    );
    const freshConnection = createDb(fresh);
    runMigrations(freshConnection.sqlite, freshConnection.db);
    freshConnection.sqlite.close();

    expect(schemaOf(adopted)).toEqual(schemaOf(fresh));
  });
});
