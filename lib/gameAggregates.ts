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
    with: { steamGame: true, gogGame: true },
  });
  if (!gameRecord) {
    throw new Error(`Game ${gameId} not found`);
  }
  const playtimeMinutes =
    (gameRecord.steamGame?.playtimeForever ?? 0) +
    (gameRecord.gogGame?.playtimeMinutes ?? 0);
  const lastPlayedAt = maxDate(
    steamLastPlayedAt(gameRecord.steamGame?.rTimeLastPlayed),
    gameRecord.gogGame?.lastPlayedAt ?? null,
  );
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
