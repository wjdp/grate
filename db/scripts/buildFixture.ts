// Builds test/fixtures/prisma-at-gog_game.sqlite: a Prisma database one
// migration behind HEAD, holding synthetic data only. Migration SQL is
// read from db/adopt/, where it lives for the Drizzle adoption path too.
// Run with: node db/scripts/buildFixture.ts

import { createHash, randomUUID } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

const MIGRATIONS = [
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

const PRISMA_MIGRATIONS_TABLE = `CREATE TABLE "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
)`;

const STEAM_ID = 76561198032111170n;
const FIRST_APPLIED_AT = Date.UTC(2025, 2, 29, 0, 2, 48);

const root = process.cwd();
const fixturePath = join(root, "test", "fixtures", "prisma-at-gog_game.sqlite");
rmSync(fixturePath, { force: true });

const sqlite = new Database(fixturePath);
sqlite.pragma("foreign_keys = ON");

sqlite.exec(PRISMA_MIGRATIONS_TABLE);
const recordMigration = sqlite.prepare(
  `INSERT INTO _prisma_migrations
   (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
   VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
);

MIGRATIONS.forEach((name, index) => {
  const sql = readFileSync(join(root, "db", "adopt", `${name}.sql`), "utf8");
  sqlite.exec(sql);
  const appliedAt = FIRST_APPLIED_AT + index * 1000;
  recordMigration.run(
    randomUUID(),
    createHash("sha256").update(sql).digest("hex"),
    appliedAt + 50,
    name,
    appliedAt,
  );
});

const games = [
  { name: "Cobbled Together", appId: 100001n, playtimeForever: 1200 },
  { name: "Turnip Frontier", appId: 100002n, playtimeForever: 0 },
  { name: "Marmalade Skies", appId: 100003n, playtimeForever: 45 },
];

const insertGame = sqlite.prepare(
  `INSERT INTO "Game" ("name", "state") VALUES (?, ?)`,
);
const insertSteamGame = sqlite.prepare(
  `INSERT INTO "SteamGame"
   ("appId", "gameId", "appInfoState", "name", "playtimeForever", "playtime2weeks",
    "playtimeWindowsForever", "playtimeMacForever", "playtimeLinuxForever",
    "playtimeDeckForever", "playtimeDisconnected", "rTimeLastPlayed",
    "imgIconUrl", "capsuleFilename", "hasCommunityVisibleStats", "hasWorkshop",
    "hasDlc", "hasLeaderboards")
   VALUES (?, ?, ?, ?, ?, 0, ?, 0, 0, 0, 0, ?, ?, ?, 1, 0, 0, 0)`,
);

sqlite.exec(`INSERT INTO "User" DEFAULT VALUES`);
sqlite
  .prepare(
    `INSERT INTO "SteamUser"
     ("steamId", "userId", "personaName", "realName", "profileUrl", "avatar",
      "avatarMedium", "avatarFull", "avatarHash", "lastLogoff")
     VALUES (?, 1, 'fixture-persona', 'Fixture Person',
       'https://example.invalid/profile', 'https://example.invalid/a.jpg',
       'https://example.invalid/b.jpg', 'https://example.invalid/c.jpg',
       'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 1742778000)`,
  )
  .run(STEAM_ID);

games.forEach((entry, index) => {
  const state = index === 0 ? "PLAYING" : index === 1 ? "BACKLOG" : null;
  const gameId = Number(insertGame.run(entry.name, state).lastInsertRowid);
  const rTimeLastPlayed =
    entry.playtimeForever === 0 ? 0 : 1742778000 - index * 86400;
  insertSteamGame.run(
    entry.appId,
    gameId,
    index === 0 ? "FETCHED" : "NOT_FETCHED",
    entry.name,
    entry.playtimeForever,
    entry.playtimeForever,
    rTimeLastPlayed,
    "https://example.invalid/icon.jpg",
    "capsule_616x353.jpg",
  );
});

sqlite
  .prepare(
    `INSERT INTO "SteamAppInfo"
     ("appId", "fetchedAt", "type", "name", "requiredAge", "isFree",
      "detailedDescription", "aboutTheGame", "shortDescription", "headerImage",
      "capsuleImage", "capsuleImagev5", "website", "developers", "publishers",
      "platformWindows", "platformMac", "platformLinux", "metacriticScore",
      "metacriticUrl", "categories", "genres", "screenshots", "releaseDate",
      "comingSoon", "background", "backgroundRaw")
     VALUES (?, ?, 'game', 'Cobbled Together', 0, 0, 'Detailed', 'About',
       'Short', 'header.jpg', 'capsule.jpg', 'capsulev5.jpg', NULL,
       '["Fixture Studio"]', '["Fixture Publishing"]', 1, 0, 1, NULL, NULL,
       '[]', '[]', '[]', NULL, 0, 'bg.jpg', 'bg_raw.jpg')`,
  )
  .run(games[0]!.appId, 1742778002795);

const insertPlaytime = sqlite.prepare(
  `INSERT INTO "SteamGamePlaytime"
   ("steamAppId", "timestampStart", "timestampEnd", "playtimeForever",
    "playtime2weeks", "playtimeWindowsForever", "playtimeMacForever",
    "playtimeLinuxForever", "playtimeDeckForever", "playtimeDisconnected",
    "rTimeLastPlayed")
   VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0, ?)`,
);
insertPlaytime.run(
  games[0]!.appId,
  1742691602795,
  1742778002795,
  600,
  1742691600,
);
insertPlaytime.run(
  games[0]!.appId,
  1742778002795,
  1742864402795,
  1200,
  1742778000,
);
insertPlaytime.run(games[2]!.appId, null, 1742864402795, 45, 1742605200);

const insertStateChange = sqlite.prepare(
  `INSERT INTO "GameStateChange" ("gameId", "state", "timestamp") VALUES (?, ?, ?)`,
);
insertStateChange.run(1, "BACKLOG", 1741384197263);
insertStateChange.run(1, "PLAYING", 1741390287422);

sqlite.exec("VACUUM");
sqlite.close();

console.log(`Wrote ${fixturePath}`);
