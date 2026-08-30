-- CreateTable
CREATE TABLE "GogGamePlaytime" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gogId" INTEGER NOT NULL,
    "timestampStart" DATETIME,
    "timestampEnd" DATETIME NOT NULL,
    "playtimeMinutes" INTEGER NOT NULL,
    "lastPlayedAt" DATETIME,
    CONSTRAINT "GogGamePlaytime_gogId_fkey" FOREIGN KEY ("gogId") REFERENCES "GogGame" ("gogId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GogIgnoredProduct" (
    "gogId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Game" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "state" TEXT,
    "playtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" DATETIME
);
INSERT INTO "new_Game" ("id", "name", "state") SELECT "id", "name", "state" FROM "Game";
DROP TABLE "Game";
ALTER TABLE "new_Game" RENAME TO "Game";
CREATE TABLE "new_GogGame" (
    "gogId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "releaseDate" DATETIME,
    "description" TEXT,
    "publisher" TEXT,
    "developer" TEXT,
    "tags" JSONB NOT NULL,
    "properties" JSONB NOT NULL,
    "iconUrl" TEXT,
    "iconSquareUrl" TEXT,
    "logoUrl" TEXT,
    "boxArtImageUrl" TEXT,
    "backgroundImageUrl" TEXT,
    "galaxyBackgroundImageUrl" TEXT,
    "productType" TEXT NOT NULL DEFAULT 'GAME',
    "playtimeMinutes" INTEGER,
    "lastPlayedAt" DATETIME,
    CONSTRAINT "GogGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GogGame" ("backgroundImageUrl", "boxArtImageUrl", "description", "developer", "galaxyBackgroundImageUrl", "gameId", "gogId", "iconSquareUrl", "iconUrl", "logoUrl", "name", "properties", "publisher", "releaseDate", "tags") SELECT "backgroundImageUrl", "boxArtImageUrl", "description", "developer", "galaxyBackgroundImageUrl", "gameId", "gogId", "iconSquareUrl", "iconUrl", "logoUrl", "name", "properties", "publisher", "releaseDate", "tags" FROM "GogGame";
DROP TABLE "GogGame";
ALTER TABLE "new_GogGame" RENAME TO "GogGame";
CREATE UNIQUE INDEX "GogGame_gameId_key" ON "GogGame"("gameId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill Game.playtimeMinutes and Game.lastPlayedAt from existing SteamGame data
UPDATE "Game" SET
    "playtimeMinutes" = COALESCE((SELECT "playtimeForever" FROM "SteamGame" WHERE "SteamGame"."gameId" = "Game"."id"), 0),
    "lastPlayedAt" = (SELECT CASE WHEN "rTimeLastPlayed" IS NULL OR "rTimeLastPlayed" = 0 THEN NULL ELSE strftime('%Y-%m-%dT%H:%M:%S.000Z', "rTimeLastPlayed", 'unixepoch') END FROM "SteamGame" WHERE "SteamGame"."gameId" = "Game"."id");
