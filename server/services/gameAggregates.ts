import { and, eq, inArray } from "drizzle-orm";
import { resolveFuzzyDateRange } from "#shared/fuzzyDate";
import type { PlaytimeProvider } from "#shared/types/PlaytimeSession";
import { db } from "~~/server/database/client";
import {
  type Game,
  game,
  type PlaytimeCorrection,
  playtimeCorrection,
} from "~~/server/database/schema";
import { getPlayDaySettings } from "~~/server/services/settings";

// Queried here rather than through playtimeCorrections, which refreshes
// aggregates and would import this module back.
function correctionsForRows(
  rows: { provider: PlaytimeProvider; providerIds: number[] }[],
): PlaytimeCorrection[] {
  return rows
    .filter(({ providerIds }) => providerIds.length > 0)
    .flatMap(({ provider, providerIds }) =>
      db
        .select()
        .from(playtimeCorrection)
        .where(
          and(
            eq(playtimeCorrection.provider, provider),
            inArray(playtimeCorrection.providerId, providerIds),
          ),
        )
        .all(),
    );
}

function latestCorrectedPlay(
  corrections: PlaytimeCorrection[],
  timezone: string,
  now: Date,
): Date | null {
  return corrections
    .map((correction) => {
      const { latest } = resolveFuzzyDateRange(
        correction.playedFrom,
        correction.playedTo,
        timezone,
      );
      return latest > now ? now : latest;
    })
    .reduce<Date | null>(maxDate, null);
}

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

export async function refreshGameAggregates(
  gameId: number,
  now: Date = new Date(),
): Promise<Game> {
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
  const corrections = correctionsForRows([
    {
      provider: "steam",
      providerIds: gameRecord.steamGames.map((row) => row.appId),
    },
    {
      provider: "gog",
      providerIds: gameRecord.gogGames.map((row) => row.gogId),
    },
    {
      provider: "epic",
      providerIds: gameRecord.epicGames.map((row) => row.epicId),
    },
  ]);
  const manualMinutes = corrections
    .filter((correction) => correction.snapshotId === null)
    .reduce((total, correction) => total + correction.minutes, 0);
  const { timezone } = await getPlayDaySettings();
  const observedLastPlayedAt = [
    ...gameRecord.steamGames.map((row) =>
      steamLastPlayedAt(row.rTimeLastPlayed),
    ),
    ...gameRecord.gogGames.map((row) => row.lastPlayedAt),
    ...gameRecord.epicGames.map((row) => row.lastPlayedAt),
  ].reduce<Date | null>(maxDate, null);
  const lastPlayedAt = maxDate(
    observedLastPlayedAt,
    latestCorrectedPlay(corrections, timezone, now),
  );
  return db
    .update(game)
    .set({ playtimeMinutes: playtimeMinutes + manualMinutes, lastPlayedAt })
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
