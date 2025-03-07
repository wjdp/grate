-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GameStateChange" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "state" TEXT,
    "timestamp" DATETIME NOT NULL,
    CONSTRAINT "GameStateChange_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GameStateChange" ("gameId", "id", "state", "timestamp") SELECT "gameId", "id", "state", "timestamp" FROM "GameStateChange";
DROP TABLE "GameStateChange";
ALTER TABLE "new_GameStateChange" RENAME TO "GameStateChange";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
