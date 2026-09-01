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

const FIXTURE_STEAM_ID = "76561198032111170";

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

// Every column the schema declares as a timestamp; after 0001 none may hold text.
const DATETIME_COLUMNS: [table: string, column: string][] = [
  ["GogUser", "accessTokenExpiresAt"],
  ["Game", "lastPlayedAt"],
  ["GameStateChange", "timestamp"],
  ["GameDistinctPair", "createdAt"],
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
  ["EpicUser", "accessTokenExpiresAt"],
  ["EpicUser", "refreshTokenExpiresAt"],
  ["EpicGame", "releaseDate"],
  ["EpicGame", "acquisitionDate"],
  ["EpicGame", "lastPlayedAt"],
  ["EpicGamePlaytime", "timestampStart"],
  ["EpicGamePlaytime", "timestampEnd"],
  ["EpicGamePlaytime", "lastPlayedAt"],
  ["EpicIgnoredItem", "createdAt"],
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

function workingCopy(name: string) {
  const path = temporaryPath(name);
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

function freshDatabase() {
  const path = temporaryPath("fresh.sqlite");
  const { db, sqlite } = open(path);
  runMigrations(sqlite, db);
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

function rowCounts(path: string) {
  return withSqlite(path, (sqlite) =>
    Object.fromEntries(
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
    ),
  );
}

// The fixture's ungrounded first record was last played at this instant.
const GROUNDED_AT = 1742605200000;

function groundedPlaytime(path: string, steamAppId: number) {
  return withSqlite(
    path,
    (sqlite) =>
      sqlite
        .prepare(
          `SELECT "timestampStart", "timestampEnd", "playtimeForever"
           FROM "SteamGamePlaytime" WHERE "steamAppId" = ?
           ORDER BY "timestampEnd"`,
        )
        .raw()
        .all(steamAppId) as [number | null, number, number][],
  );
}

function migrationCounts(path: string) {
  return withSqlite(path, (sqlite) => ({
    prisma: (
      sqlite.prepare(`SELECT count(*) FROM _prisma_migrations`).raw().get() as [
        number,
      ]
    )[0],
    drizzle: (
      sqlite
        .prepare(`SELECT count(*) FROM __drizzle_migrations`)
        .raw()
        .get() as [number]
    )[0],
  }));
}

function lastPlayedAt(path: string) {
  return withSqlite(
    path,
    (sqlite) =>
      sqlite
        .prepare(
          `SELECT "id", typeof("lastPlayedAt"), "lastPlayedAt"
           FROM "Game" WHERE "lastPlayedAt" IS NOT NULL ORDER BY "id"`,
        )
        .raw()
        .all() as [number, string, string | number][],
  );
}

function lastPlayedAtTypes(path: string) {
  return [...new Set(lastPlayedAt(path).map(([, type]) => type))];
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

function distinctValues(path: string, table: string, column: string) {
  return withSqlite(
    path,
    (sqlite) =>
      sqlite
        .prepare(`SELECT DISTINCT "${column}" FROM "${table}"`)
        .raw()
        .all() as [unknown][],
  ).map(([value]) => value);
}

function expectNativeStorage(path: string) {
  for (const [table, column] of DATETIME_COLUMNS) {
    expect([table, column, storageClasses(path, table, column)]).toEqual([
      table,
      column,
      expect.not.arrayContaining(["text"]),
    ]);
    expect(storageClasses(path, table, column)).toEqual(
      expect.not.arrayContaining(["real", "blob"]),
    );
  }

  expect(storageClasses(path, "SteamUser", "steamId")).toEqual(["text"]);
  expect(storageClasses(path, "SteamGame", "appId")).toEqual(["integer"]);
  expect(storageClasses(path, "SteamAppInfo", "appId")).toEqual(["integer"]);
  expect(storageClasses(path, "SteamGamePlaytime", "steamAppId")).toEqual([
    "integer",
  ]);

  for (const column of [
    "hasCommunityVisibleStats",
    "hasWorkshop",
    "hasDlc",
    "hasLeaderboards",
  ]) {
    const values = withSqlite(
      path,
      (sqlite) =>
        sqlite
          .prepare(`SELECT DISTINCT "${column}" FROM "SteamGame"`)
          .raw()
          .all() as [number][],
    ).map(([value]) => value);
    expect(values.every((value) => value === 0 || value === 1)).toBe(true);
  }

  expect(storageClasses(path, "Game", "hidden")).toEqual(["integer"]);
  expect(distinctValues(path, "Game", "hidden")).toEqual([0]);
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
    ).toEqual([10]);
    expect(tables).not.toContain("_prisma_migrations");
  });

  it("adopts a Prisma database that is one migration behind", () => {
    const path = workingCopy("behind.sqlite");
    const before = rowCounts(path);

    const { db, sqlite } = open(path);
    runMigrations(sqlite, db);

    expect(schemaOf(path)).toEqual(schemaOf(freshDatabase()));

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
    expect(migrationCounts(path)).toEqual({ prisma: 12, drizzle: 10 });

    const backfilled = sqlite
      .prepare(
        `SELECT g."playtimeMinutes", g."lastPlayedAt", s."playtimeForever"
         FROM "Game" g JOIN "SteamGame" s ON s."gameId" = g."id" ORDER BY g."id"`,
      )
      .raw()
      .all() as [number, number | null, number][];
    expect(backfilled.map(([minutes]) => minutes)).toEqual([1200, 0, 45]);
    expect(backfilled[0]![1]).toBe(Date.parse("2025-03-24T01:00:00.000Z"));
    expect(backfilled[1]![1]).toBeNull();
    expect(lastPlayedAtTypes(path)).toEqual(["integer"]);

    expectNativeStorage(path);

    // The fixture's app 100003 holds the only first record still starting at
    // NULL, so grounding it on rTimeLastPlayed splits that row in two.
    expect(groundedPlaytime(path, 100003)).toEqual([
      [null, GROUNDED_AT, 45],
      [GROUNDED_AT, 1742864402795, 45],
    ]);

    expect(rowCounts(path)).toEqual({
      ...before,
      SteamGamePlaytime: 4,
      GogGamePlaytime: 0,
      GogIgnoredProduct: 0,
      EpicUser: 0,
      EpicGame: 0,
      EpicGamePlaytime: 0,
      EpicIgnoredItem: 0,
      GameDistinctPair: 0,
      SteamPicsMetadata: 0,
      SteamTag: 0,
    });
  });

  it("converts a Prisma database that is already at head", () => {
    const path = fixtureAtPrismaHead();
    const before = rowCounts(path);
    const isoBefore = lastPlayedAt(path);
    expect(lastPlayedAtTypes(path)).toEqual(["text"]);

    const { db, sqlite } = open(path);
    runMigrations(sqlite, db);

    expect(migrationCounts(path)).toEqual({ prisma: 12, drizzle: 10 });
    expect(rowCounts(path)).toEqual({
      ...before,
      SteamGamePlaytime: 4,
      EpicUser: 0,
      EpicGame: 0,
      EpicGamePlaytime: 0,
      EpicIgnoredItem: 0,
      GameDistinctPair: 0,
      SteamPicsMetadata: 0,
      SteamTag: 0,
    });
    expect(lastPlayedAt(path)).toEqual(
      isoBefore.map(([id, , value]) => [
        id,
        "integer",
        Date.parse(value as string),
      ]),
    );
    expectNativeStorage(path);
  });

  it("keeps the 64-bit steam id exact when it becomes text", () => {
    const path = workingCopy("steam-id.sqlite");
    const { db, sqlite } = open(path);
    runMigrations(sqlite, db);

    const [steamId, storageClass] = sqlite
      .prepare(`SELECT "steamId", typeof("steamId") FROM "SteamUser"`)
      .raw()
      .get() as [string, string];
    expect(storageClass).toBe("text");
    expect(steamId).toBe(FIXTURE_STEAM_ID);
  });

  it("keeps json columns readable as json", () => {
    const path = workingCopy("json.sqlite");
    const { db, sqlite } = open(path);
    runMigrations(sqlite, db);

    const [developers, publishers] = sqlite
      .prepare(`SELECT "developers", "publishers" FROM "SteamAppInfo"`)
      .raw()
      .get() as [string, string];
    expect(JSON.parse(developers)).toEqual(["Fixture Studio"]);
    expect(JSON.parse(publishers)).toEqual(["Fixture Publishing"]);
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
    expect(migrationCounts(path)).toEqual({ prisma: 12, drizzle: 10 });
    expectNativeStorage(path);
  });
});
