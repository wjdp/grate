import { asc, desc, eq, isNotNull } from "drizzle-orm";
import {
  game,
  gameStateChange,
  gogGamePlaytime,
  steamGamePlaytime,
} from "~~/db/schema";
import { db } from "~~/lib/db";
import type { GameState } from "~~/shared/game-state";

export type PlaytimeProvider = "steam" | "gog";

export interface GamePlaytimeRecord {
  timestampStart: Date | null;
  timestampEnd: Date;
  playtimeMinutes: number;
  provider: PlaytimeProvider;
}

export async function getGames() {
  return await db.query.game.findMany({
    with: { steamGame: true, gogGame: true },
    orderBy: asc(game.name),
  });
}

export async function getGame(id: number) {
  return (
    (await db.query.game.findFirst({
      where: eq(game.id, id),
      with: { steamGame: { with: { appInfo: true } }, gogGame: true },
    })) ?? null
  );
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
  const gameRecord = await db.query.game.findFirst({
    where: eq(game.id, id),
    with: { steamGame: true, gogGame: true },
  });
  if (!gameRecord) {
    throw new Error("Game not found");
  }
  const records: GamePlaytimeRecord[] = [];
  if (gameRecord.steamGame) {
    const steamRecords = await db
      .select()
      .from(steamGamePlaytime)
      .where(eq(steamGamePlaytime.steamAppId, gameRecord.steamGame.appId))
      .all();
    records.push(
      ...steamRecords.map((record) => ({
        timestampStart: record.timestampStart,
        timestampEnd: record.timestampEnd,
        playtimeMinutes: record.playtimeForever ?? 0,
        provider: "steam" as const,
      })),
    );
  }
  if (gameRecord.gogGame) {
    const gogRecords = await db
      .select()
      .from(gogGamePlaytime)
      .where(eq(gogGamePlaytime.gogId, gameRecord.gogGame.gogId))
      .all();
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
  return await db.query.game.findMany({
    with: { steamGame: { with: { appInfo: true } }, gogGame: true },
    where: isNotNull(game.lastPlayedAt),
    orderBy: desc(game.lastPlayedAt),
    limit,
  });
}

export async function setGameState(id: number, state: GameState | null) {
  const now = new Date();
  const gameBeforeUpdate = db.select().from(game).where(eq(game.id, id)).get();
  if (!gameBeforeUpdate) {
    throw new Error("Game not found");
  }
  if (gameBeforeUpdate.state === state) {
    // No change
    console.log(`There is no change in state for game ${id}`);
    return gameBeforeUpdate;
  }
  const updatedGame = db
    .update(game)
    .set({ state })
    .where(eq(game.id, id))
    .returning()
    .get();
  db.insert(gameStateChange)
    .values({ gameId: updatedGame.id, state, timestamp: now })
    .run();
  return updatedGame;
}
