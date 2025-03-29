-- CreateTable
CREATE TABLE "GogGame" (
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
    CONSTRAINT "GogGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GogGame_gameId_key" ON "GogGame"("gameId");
