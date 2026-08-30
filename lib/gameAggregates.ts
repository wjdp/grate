import type { Game } from "@prisma/client";
import prisma from "./prisma";

function steamLastPlayedAt(rTimeLastPlayed: number | null | undefined) {
  if (!rTimeLastPlayed) {
    return null;
  }
  return new Date(rTimeLastPlayed * 1000);
}

function maxDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export async function refreshGameAggregates(gameId: number): Promise<Game> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { steamGame: true, gogGame: true },
  });
  if (!game) {
    throw new Error(`Game ${gameId} not found`);
  }
  const playtimeMinutes =
    (game.steamGame?.playtimeForever ?? 0) +
    (game.gogGame?.playtimeMinutes ?? 0);
  const lastPlayedAt = maxDate(
    steamLastPlayedAt(game.steamGame?.rTimeLastPlayed),
    game.gogGame?.lastPlayedAt ?? null,
  );
  return prisma.game.update({
    where: { id: gameId },
    data: { playtimeMinutes, lastPlayedAt },
  });
}

export async function refreshAllGameAggregates(): Promise<void> {
  const games = await prisma.game.findMany({ select: { id: true } });
  for (const game of games) {
    await refreshGameAggregates(game.id);
  }
}
