-- CreateTable
CREATE TABLE "GogUser" (
    "gogUserId" TEXT NOT NULL PRIMARY KEY,
    "galaxyUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "checksumGames" TEXT NOT NULL,
    "avatarUrl" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "accessTokenExpiresAt" DATETIME NOT NULL,
    "refreshToken" TEXT NOT NULL
);
