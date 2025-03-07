-- AlterTable
ALTER TABLE "Game" ADD COLUMN "state" TEXT;

-- CreateTable
CREATE TABLE "GameStateChange" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    CONSTRAINT "GameStateChange_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
