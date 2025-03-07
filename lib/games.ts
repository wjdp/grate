import prisma from "./prisma";

export async function getGames() {
  return await prisma.game.findMany({
    include: { steamGame: true },
    orderBy: { name: "asc" },
  });
}

export async function getGame(id: number) {
  return await prisma.game.findUnique({
    where: { id },
    include: { steamGame: true },
  });
}

export async function getGamePlaytimes(id: number) {
  const game = await prisma.game.findUnique({
    where: { id },
    include: { steamGame: true },
  });
  if (!game) {
    throw new Error("Game not found");
  }
  if (!game.steamGame) {
    throw new Error("Game is not a Steam game");
  }
  return await prisma.steamGamePlaytime.findMany({
    where: { steamAppId: game.steamGame.appId },
    orderBy: { timestampStart: "desc" },
  });
}
