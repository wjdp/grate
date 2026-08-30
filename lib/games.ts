import { asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import {
  game,
  gameStateChange,
  gogGame,
  gogGamePlaytime,
  steamGame,
  steamGamePlaytime,
  type Game,
} from "~~/db/schema";
import { db } from "~~/lib/db";
import { refreshGameAggregates } from "~~/lib/gameAggregates";
import { countProviderRows } from "~~/lib/gameProviders";
import type { GameState } from "~~/shared/game-state";

export type PlaytimeProvider = "steam" | "gog";

export interface GamePlaytimeRecord {
  timestampStart: Date | null;
  timestampEnd: Date;
  playtimeMinutes: number;
  provider: PlaytimeProvider;
  providerId: number;
  providerName: string;
}

const providerRows = {
  steamGames: { orderBy: asc(steamGame.appId) },
  gogGames: { orderBy: asc(gogGame.gogId) },
} as const;

const providerRowsWithAppInfo = {
  steamGames: { orderBy: asc(steamGame.appId), with: { appInfo: true } },
  gogGames: { orderBy: asc(gogGame.gogId) },
} as const;

export async function getGames() {
  return await db.query.game.findMany({
    with: providerRows,
    orderBy: asc(game.name),
  });
}

export async function getGame(id: number) {
  return (
    (await db.query.game.findFirst({
      where: eq(game.id, id),
      with: providerRowsWithAppInfo,
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
    with: providerRows,
  });
  if (!gameRecord) {
    throw new Error("Game not found");
  }
  const records: GamePlaytimeRecord[] = [];
  for (const steamRow of gameRecord.steamGames) {
    const steamRecords = await db
      .select()
      .from(steamGamePlaytime)
      .where(eq(steamGamePlaytime.steamAppId, steamRow.appId))
      .all();
    records.push(
      ...steamRecords.map((record) => ({
        timestampStart: record.timestampStart,
        timestampEnd: record.timestampEnd,
        playtimeMinutes: record.playtimeForever ?? 0,
        provider: "steam" as const,
        providerId: steamRow.appId,
        providerName: steamRow.name,
      })),
    );
  }
  for (const gogRow of gameRecord.gogGames) {
    const gogRecords = await db
      .select()
      .from(gogGamePlaytime)
      .where(eq(gogGamePlaytime.gogId, gogRow.gogId))
      .all();
    records.push(
      ...gogRecords.map((record) => ({
        timestampStart: record.timestampStart,
        timestampEnd: record.timestampEnd,
        playtimeMinutes: record.playtimeMinutes,
        provider: "gog" as const,
        providerId: gogRow.gogId,
        providerName: gogRow.name,
      })),
    );
  }
  return records.sort(byTimestampStartDescending);
}

export async function getRecentGames(limit: number = 6) {
  return await db.query.game.findMany({
    with: providerRowsWithAppInfo,
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

function assertMergeInputs(targetId: number, sourceIds: number[]) {
  if (sourceIds.length === 0) {
    throw new Error("No source games given to merge");
  }
  if (sourceIds.includes(targetId)) {
    throw new Error("Cannot merge a game into itself");
  }
  if (new Set(sourceIds).size !== sourceIds.length) {
    throw new Error("Duplicate source game ids");
  }
}

function inheritedState(
  sources: Game[],
  stateChanges: { gameId: number; timestamp: Date }[],
): GameState | null {
  const latestChangeByGameId = new Map<number, number>();
  for (const change of stateChanges) {
    const latest = latestChangeByGameId.get(change.gameId);
    const timestamp = change.timestamp.getTime();
    if (latest === undefined || timestamp > latest) {
      latestChangeByGameId.set(change.gameId, timestamp);
    }
  }
  const candidates = sources
    .filter((source) => source.state !== null)
    .sort(
      (a, b) =>
        (latestChangeByGameId.get(b.id) ?? -Infinity) -
        (latestChangeByGameId.get(a.id) ?? -Infinity),
    );
  return candidates[0]?.state ?? null;
}

export async function mergeGames(
  targetId: number,
  sourceIds: number[],
): Promise<Game> {
  assertMergeInputs(targetId, sourceIds);
  db.transaction((tx) => {
    const target = tx.select().from(game).where(eq(game.id, targetId)).get();
    if (!target) {
      throw new Error(`Game ${targetId} not found`);
    }
    const sources = tx
      .select()
      .from(game)
      .where(inArray(game.id, sourceIds))
      .all();
    const missingId = sourceIds.find(
      (sourceId) => !sources.some((source) => source.id === sourceId),
    );
    if (missingId !== undefined) {
      throw new Error(`Game ${missingId} not found`);
    }
    const sourceStateChanges = tx
      .select()
      .from(gameStateChange)
      .where(inArray(gameStateChange.gameId, sourceIds))
      .all();
    tx.update(steamGame)
      .set({ gameId: targetId })
      .where(inArray(steamGame.gameId, sourceIds))
      .run();
    tx.update(gogGame)
      .set({ gameId: targetId })
      .where(inArray(gogGame.gameId, sourceIds))
      .run();
    tx.update(gameStateChange)
      .set({ gameId: targetId })
      .where(inArray(gameStateChange.gameId, sourceIds))
      .run();
    if (target.state === null) {
      const state = inheritedState(sources, sourceStateChanges);
      if (state !== null) {
        tx.update(game).set({ state }).where(eq(game.id, targetId)).run();
        tx.insert(gameStateChange)
          .values({ gameId: targetId, state, timestamp: new Date() })
          .run();
      }
    }
    tx.delete(game).where(inArray(game.id, sourceIds)).run();
  });
  return await refreshGameAggregates(targetId);
}

export async function splitGame(
  provider: PlaytimeProvider,
  providerId: number,
): Promise<Game> {
  const providerRow =
    provider === "steam"
      ? db.select().from(steamGame).where(eq(steamGame.appId, providerId)).get()
      : db.select().from(gogGame).where(eq(gogGame.gogId, providerId)).get();
  if (!providerRow) {
    throw new Error(`No ${provider} game ${providerId}`);
  }
  const previousGameId = providerRow.gameId;
  if (countProviderRows(previousGameId) === 1) {
    const existingGame = db
      .select()
      .from(game)
      .where(eq(game.id, previousGameId))
      .get();
    if (!existingGame) {
      throw new Error(`Game ${previousGameId} not found`);
    }
    return existingGame;
  }
  const splitOffGame = db.transaction((tx) => {
    const createdGame = tx
      .insert(game)
      .values({ name: providerRow.name })
      .returning()
      .get();
    if (provider === "steam") {
      tx.update(steamGame)
        .set({ gameId: createdGame.id })
        .where(eq(steamGame.appId, providerId))
        .run();
    } else {
      tx.update(gogGame)
        .set({ gameId: createdGame.id })
        .where(eq(gogGame.gogId, providerId))
        .run();
    }
    return createdGame;
  });
  await refreshGameAggregates(previousGameId);
  return await refreshGameAggregates(splitOffGame.id);
}
