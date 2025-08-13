import type { GameState } from "@prisma/client";
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
    include: { steamGame: { include: { appInfo: true } } },
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

export async function getRecentGames(limit: number = 6) {
  return await prisma.game.findMany({
    include: { steamGame: { include: { appInfo: true } } },
    where: {
      steamGame: {
        rTimeLastPlayed: {
          not: null,
        },
      },
    },
    orderBy: {
      steamGame: {
        rTimeLastPlayed: "desc",
      },
    },
    take: limit,
  });
}

export async function setGameState(id: number, state: GameState | null) {
  const now = new Date();
  const gameBeforeUpdate = await prisma.game.findUnique({ where: { id } });
  if (!gameBeforeUpdate) {
    throw new Error("Game not found");
  }
  if (gameBeforeUpdate.state === state) {
    // No change
    console.log(`There is no change in state for game ${id}`);
    return gameBeforeUpdate;
  }
  const game = await prisma.game.update({
    where: { id },
    data: { state },
  });
  await prisma.gameStateChange.create({
    data: { gameId: game.id, state: state, timestamp: now },
  });
  return game;
}
