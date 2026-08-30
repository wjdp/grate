/*
  Warnings:

  - Added the required column `capsuleFilename` to the `SteamGame` table without a default value. This is not possible if the table is not empty.
  - Added the required column `imgIconUrl` to the `SteamGame` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SteamGame" (
    "appId" BIGINT NOT NULL PRIMARY KEY,
    "gameId" INTEGER NOT NULL,
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
INSERT INTO "new_SteamGame" ("appId", "gameId", "name") SELECT "appId", "gameId", "name" FROM "SteamGame";
DROP TABLE "SteamGame";
ALTER TABLE "new_SteamGame" RENAME TO "SteamGame";
CREATE UNIQUE INDEX "SteamGame_gameId_key" ON "SteamGame"("gameId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
