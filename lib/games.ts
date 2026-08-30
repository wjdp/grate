import type { GameState } from "@prisma/client";
import prisma from "./prisma";

export type PlaytimeProvider = "steam" | "gog";

export interface GamePlaytimeRecord {
  timestampStart: Date | null;
  timestampEnd: Date;
  playtimeMinutes: number;
  provider: PlaytimeProvider;
}

export async function getGames() {
  return await prisma.game.findMany({
    include: { steamGame: true, gogGame: true },
    orderBy: { name: "asc" },
  });
}

export async function getGame(id: number) {
  return await prisma.game.findUnique({
    where: { id },
    include: { steamGame: { include: { appInfo: true } }, gogGame: true },
  });
}

function byTimestampStartDescending(
  a: GamePlaytimeRecord,
  b: GamePlaytimeRecord,
) {
  if (!a.timestampStart && !b.timestampStart) return 0;
  if (!a.timestampStart) return 1;
  if (!b.timestampStart) return -1;
  return b.timestampStart.getTime() - a.timestampStart.getTime();
}

export async function getGamePlaytimes(
  id: number,
): Promise<GamePlaytimeRecord[]> {
  const game = await prisma.game.findUnique({
    where: { id },
    include: { steamGame: true, gogGame: true },
  });
  if (!game) {
    throw new Error("Game not found");
  }
  const records: GamePlaytimeRecord[] = [];
  if (game.steamGame) {
    const steamRecords = await prisma.steamGamePlaytime.findMany({
      where: { steamAppId: game.steamGame.appId },
    });
    records.push(
      ...steamRecords.map((record) => ({
        timestampStart: record.timestampStart,
        timestampEnd: record.timestampEnd,
        playtimeMinutes: record.playtimeForever ?? 0,
        provider: "steam" as const,
      })),
    );
  }
  if (game.gogGame) {
    const gogRecords = await prisma.gogGamePlaytime.findMany({
      where: { gogId: game.gogGame.gogId },
    });
    records.push(
      ...gogRecords.map((record) => ({
        timestampStart: record.timestampStart,
        timestampEnd: record.timestampEnd,
        playtimeMinutes: record.playtimeMinutes,
        provider: "gog" as const,
      })),
    );
  }
  return records.sort(byTimestampStartDescending);
}

export async function getRecentGames(limit: number = 6) {
  return await prisma.game.findMany({
    include: { steamGame: { include: { appInfo: true } }, gogGame: true },
    where: { lastPlayedAt: { not: null } },
    orderBy: { lastPlayedAt: "desc" },
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
