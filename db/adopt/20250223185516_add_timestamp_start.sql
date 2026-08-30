/*
  Warnings:

  - You are about to drop the column `timestamp` on the `SteamGamePlaytime` table. All the data in the column will be lost.
  - Added the required column `timestampEnd` to the `SteamGamePlaytime` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SteamGamePlaytime" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "steamAppId" BIGINT NOT NULL,
    "timestampStart" DATETIME,
    "timestampEnd" DATETIME NOT NULL,
    "playtimeForever" INTEGER,
    "playtime2weeks" INTEGER,
    "playtimeWindowsForever" INTEGER,
    "playtimeMacForever" INTEGER,
    "playtimeLinuxForever" INTEGER,
    "playtimeDeckForever" INTEGER,
    "playtimeDisconnected" INTEGER,
    "rTimeLastPlayed" INTEGER,
    CONSTRAINT "SteamGamePlaytime_steamAppId_fkey" FOREIGN KEY ("steamAppId") REFERENCES "SteamGame" ("appId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SteamGamePlaytime" ("id", "playtime2weeks", "playtimeDeckForever", "playtimeDisconnected", "playtimeForever", "playtimeLinuxForever", "playtimeMacForever", "playtimeWindowsForever", "rTimeLastPlayed", "steamAppId", "timestampEnd") SELECT "id", "playtime2weeks", "playtimeDeckForever", "playtimeDisconnected", "playtimeForever", "playtimeLinuxForever", "playtimeMacForever", "playtimeWindowsForever", "rTimeLastPlayed", "steamAppId", "timestamp" FROM "SteamGamePlaytime";
DROP TABLE "SteamGamePlaytime";
ALTER TABLE "new_SteamGamePlaytime" RENAME TO "SteamGamePlaytime";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
