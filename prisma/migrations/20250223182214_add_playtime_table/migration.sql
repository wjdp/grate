-- CreateTable
CREATE TABLE "SteamGamePlaytime" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "steamAppId" BIGINT NOT NULL,
    "timestamp" DATETIME NOT NULL,
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
