-- CreateTable
CREATE TABLE "SteamAppInfo" (
    "appId" BIGINT NOT NULL PRIMARY KEY,
    "fetchedAt" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requiredAge" INTEGER,
    "isFree" BOOLEAN NOT NULL,
    "detailedDescription" TEXT NOT NULL,
    "aboutTheGame" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "headerImage" TEXT NOT NULL,
    "capsuleImage" TEXT NOT NULL,
    "capsuleImagev5" TEXT NOT NULL,
    "website" TEXT,
    "developers" JSONB NOT NULL,
    "publishers" JSONB NOT NULL,
    "platformWindows" BOOLEAN NOT NULL,
    "platformMac" BOOLEAN NOT NULL,
    "platformLinux" BOOLEAN NOT NULL,
    "metacriticScore" INTEGER,
    "metacriticUrl" TEXT,
    "categories" JSONB NOT NULL,
    "genres" JSONB NOT NULL,
    "screenshots" JSONB NOT NULL,
    "releaseDate" DATETIME,
    "comingSoon" BOOLEAN,
    "background" TEXT NOT NULL,
    "backgroundRaw" TEXT NOT NULL,
    CONSTRAINT "SteamAppInfo_appId_fkey" FOREIGN KEY ("appId") REFERENCES "SteamGame" ("appId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SteamGame" (
    "appId" BIGINT NOT NULL PRIMARY KEY,
    "gameId" INTEGER NOT NULL,
    "appInfoState" TEXT NOT NULL DEFAULT 'NOT_FETCHED',
    "name" TEXT NOT NULL,
    "playtimeForever" INTEGER,
    "playtime2weeks" INTEGER,
    "playtimeWindowsForever" INTEGER,
    "playtimeMacForever" INTEGER,
    "playtimeLinuxForever" INTEGER,
    "playtimeDeckForever" INTEGER,
    "playtimeDisconnected" INTEGER,
    "rTimeLastPlayed" INTEGER,
    "imgIconUrl" TEXT NOT NULL,
    "capsuleFilename" TEXT NOT NULL,
    "hasCommunityVisibleStats" BOOLEAN NOT NULL DEFAULT false,
    "hasWorkshop" BOOLEAN NOT NULL DEFAULT false,
    "hasDlc" BOOLEAN NOT NULL DEFAULT false,
    "hasLeaderboards" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SteamGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SteamGame" ("appId", "capsuleFilename", "gameId", "hasCommunityVisibleStats", "hasDlc", "hasLeaderboards", "hasWorkshop", "imgIconUrl", "name", "playtime2weeks", "playtimeDeckForever", "playtimeDisconnected", "playtimeForever", "playtimeLinuxForever", "playtimeMacForever", "playtimeWindowsForever", "rTimeLastPlayed") SELECT "appId", "capsuleFilename", "gameId", "hasCommunityVisibleStats", "hasDlc", "hasLeaderboards", "hasWorkshop", "imgIconUrl", "name", "playtime2weeks", "playtimeDeckForever", "playtimeDisconnected", "playtimeForever", "playtimeLinuxForever", "playtimeMacForever", "playtimeWindowsForever", "rTimeLastPlayed" FROM "SteamGame";
DROP TABLE "SteamGame";
ALTER TABLE "new_SteamGame" RENAME TO "SteamGame";
CREATE UNIQUE INDEX "SteamGame_gameId_key" ON "SteamGame"("gameId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
