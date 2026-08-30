import { eq } from "drizzle-orm";
import { game, type Game } from "~~/db/schema";
import { db } from "~~/lib/db";

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
  const gameRecord = await db.query.game.findFirst({
    where: eq(game.id, gameId),
    with: { steamGames: true, gogGames: true, epicGames: true },
  });
  if (!gameRecord) {
    throw new Error(`Game ${gameId} not found`);
  }
  const playtimeMinutes =
    gameRecord.steamGames.reduce(
      (total, row) => total + (row.playtimeForever ?? 0),
      0,
    ) +
    gameRecord.gogGames.reduce(
      (total, row) => total + (row.playtimeMinutes ?? 0),
      0,
    ) +
    gameRecord.epicGames.reduce(
      (total, row) => total + (row.playtimeMinutes ?? 0),
      0,
    );
  const lastPlayedAt = [
    ...gameRecord.steamGames.map((row) =>
      steamLastPlayedAt(row.rTimeLastPlayed),
    ),
    ...gameRecord.gogGames.map((row) => row.lastPlayedAt),
    ...gameRecord.epicGames.map((row) => row.lastPlayedAt),
  ].reduce<Date | null>(maxDate, null);
  return db
    .update(game)
    .set({ playtimeMinutes, lastPlayedAt })
    .where(eq(game.id, gameId))
    .returning()
    .get();
}

export async function refreshAllGameAggregates(): Promise<void> {
  const games = db.select({ id: game.id }).from(game).all();
  for (const gameRecord of games) {
    await refreshGameAggregates(gameRecord.id);
  }
}
