/*
  Warnings:

  - The primary key for the `SteamGame` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `appId` on the `SteamGame` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - The primary key for the `SteamUser` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `steamId` on the `SteamUser` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SteamGame" (
    "appId" BIGINT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    CONSTRAINT "SteamGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SteamGame" ("appId", "gameId", "name") SELECT "appId", "gameId", "name" FROM "SteamGame";
DROP TABLE "SteamGame";
ALTER TABLE "new_SteamGame" RENAME TO "SteamGame";
CREATE UNIQUE INDEX "SteamGame_gameId_key" ON "SteamGame"("gameId");
CREATE TABLE "new_SteamUser" (
    "steamId" BIGINT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "personaName" TEXT NOT NULL,
    "realName" TEXT,
    "profileUrl" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "avatarMedium" TEXT NOT NULL,
    "avatarFull" TEXT NOT NULL,
    "avatarHash" TEXT NOT NULL,
    "lastLogoff" INTEGER NOT NULL,
    CONSTRAINT "SteamUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SteamUser" ("avatar", "avatarFull", "avatarHash", "avatarMedium", "lastLogoff", "personaName", "profileUrl", "realName", "steamId", "userId") SELECT "avatar", "avatarFull", "avatarHash", "avatarMedium", "lastLogoff", "personaName", "profileUrl", "realName", "steamId", "userId" FROM "SteamUser";
DROP TABLE "SteamUser";
ALTER TABLE "new_SteamUser" RENAME TO "SteamUser";
CREATE UNIQUE INDEX "SteamUser_userId_key" ON "SteamUser"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
