import { and, asc, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import type { GameState } from "#shared/game-state";
import { playDayOf } from "#shared/playDay";
import type { PlaytimeSession } from "#shared/types/PlaytimeSession";
import {
  epicGame,
  epicGamePlaytime,
  type Game,
  game,
  gameDistinctPair,
  gameStateChange,
  gogGame,
  gogGamePlaytime,
  steamGame,
  steamGamePlaytime,
} from "~~/db/schema";
import { db } from "~~/lib/db";
import { refreshGameAggregates } from "~~/lib/gameAggregates";
import { countProviderRows } from "~~/lib/gameProviders";
import {
  deriveSessions,
  type PlaytimeProviderRow,
  type PlaytimeSnapshot,
} from "~~/lib/playtimeTimeline";
import { getPlayDaySettings } from "~~/lib/settings";

export type PlaytimeProvider = "steam" | "gog" | "epic";

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
  epicGames: { orderBy: asc(epicGame.epicId) },
} as const;

const providerRowsWithAppInfo = {
  steamGames: { orderBy: asc(steamGame.appId), with: { appInfo: true } },
  gogGames: { orderBy: asc(gogGame.gogId) },
  epicGames: { orderBy: asc(epicGame.epicId) },
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

interface ProviderRowSnapshots {
  row: PlaytimeProviderRow;
  snapshots: PlaytimeSnapshot[];
}

async function getProviderRowSnapshots(
  id: number,
): Promise<ProviderRowSnapshots[]> {
  const gameRecord = await db.query.game.findFirst({
    where: eq(game.id, id),
    with: providerRows,
  });
  if (!gameRecord) {
    throw new Error("Game not found");
  }
  const rows: ProviderRowSnapshots[] = [];
  for (const steamRow of gameRecord.steamGames) {
    const steamRecords = await db
      .select()
      .from(steamGamePlaytime)
      .where(eq(steamGamePlaytime.steamAppId, steamRow.appId))
      .all();
    rows.push({
      row: {
        provider: "steam",
        providerId: steamRow.appId,
        providerName: steamRow.name,
      },
      snapshots: steamRecords.map((record) => ({
        timestampStart: record.timestampStart,
        timestampEnd: record.timestampEnd,
        playtimeMinutes: record.playtimeForever ?? 0,
        rTimeLastPlayed: record.rTimeLastPlayed,
        playtimeDisconnected: record.playtimeDisconnected,
      })),
    });
  }
  for (const gogRow of gameRecord.gogGames) {
    const gogRecords = await db
      .select()
      .from(gogGamePlaytime)
      .where(eq(gogGamePlaytime.gogId, gogRow.gogId))
      .all();
    rows.push({
      row: {
        provider: "gog",
        providerId: gogRow.gogId,
        providerName: gogRow.name,
      },
      snapshots: gogRecords.map((record) => ({
        timestampStart: record.timestampStart,
        timestampEnd: record.timestampEnd,
        playtimeMinutes: record.playtimeMinutes,
      })),
    });
  }
  for (const epicRow of gameRecord.epicGames) {
    const epicRecords = await db
      .select()
      .from(epicGamePlaytime)
      .where(eq(epicGamePlaytime.epicId, epicRow.epicId))
      .all();
    rows.push({
      row: {
        provider: "epic",
        providerId: epicRow.epicId,
        providerName: epicRow.name,
      },
      snapshots: epicRecords.map((record) => ({
        timestampStart: record.timestampStart,
        timestampEnd: record.timestampEnd,
        playtimeMinutes: record.playtimeMinutes,
      })),
    });
  }
  return rows;
}

export async function getGamePlaytimes(
  id: number,
): Promise<GamePlaytimeRecord[]> {
  const rows = await getProviderRowSnapshots(id);
  return rows
    .flatMap(({ row, snapshots }) =>
      snapshots.map((snapshot) => ({
        timestampStart: snapshot.timestampStart,
        timestampEnd: snapshot.timestampEnd,
        playtimeMinutes: snapshot.playtimeMinutes,
        provider: row.provider,
        providerId: row.providerId,
        providerName: row.providerName,
      })),
    )
    .sort(byTimestampStartDescending);
}

export async function getGameTimeline(id: number): Promise<PlaytimeSession[]> {
  const rows = await getProviderRowSnapshots(id);
  const playDaySettings = await getPlayDaySettings();
  return rows
    .flatMap(({ row, snapshots }) => deriveSessions(snapshots, row))
    .map((session) => ({
      ...session,
      playDay: playDayOf(session.endedBefore, playDaySettings),
    }))
    .sort((a, b) => b.endedBefore.getTime() - a.endedBefore.getTime());
}

export async function getRecentGames(limit: number = 6) {
  return await db.query.game.findMany({
    with: providerRowsWithAppInfo,
    where: and(isNotNull(game.lastPlayedAt), eq(game.hidden, false)),
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

export async function setGameHidden(id: number, hidden: boolean) {
  const updatedGame = db
    .update(game)
    .set({ hidden })
    .where(eq(game.id, id))
    .returning()
    .get();
  if (!updatedGame) {
    throw new Error("Game not found");
  }
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

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function repointDistinctPairs(
  tx: Transaction,
  targetId: number,
  sourceIds: number[],
) {
  const pairs = tx
    .select()
    .from(gameDistinctPair)
    .where(
      or(
        inArray(gameDistinctPair.gameAId, sourceIds),
        inArray(gameDistinctPair.gameBId, sourceIds),
      ),
    )
    .all();
  if (pairs.length === 0) {
    return;
  }
  const isSource = (id: number) => sourceIds.includes(id);
  tx.delete(gameDistinctPair)
    .where(
      inArray(
        gameDistinctPair.id,
        pairs.map((pair) => pair.id),
      ),
    )
    .run();
  for (const pair of pairs) {
    const a = isSource(pair.gameAId) ? targetId : pair.gameAId;
    const b = isSource(pair.gameBId) ? targetId : pair.gameBId;
    if (a === b) {
      continue;
    }
    tx.insert(gameDistinctPair)
      .values({
        gameAId: Math.min(a, b),
        gameBId: Math.max(a, b),
        createdAt: pair.createdAt,
      })
      .onConflictDoNothing()
      .run();
  }
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
    tx.update(epicGame)
      .set({ gameId: targetId })
      .where(inArray(epicGame.gameId, sourceIds))
      .run();
    tx.update(gameStateChange)
      .set({ gameId: targetId })
      .where(inArray(gameStateChange.gameId, sourceIds))
      .run();
    repointDistinctPairs(tx, targetId, sourceIds);
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
      : provider === "gog"
        ? db.select().from(gogGame).where(eq(gogGame.gogId, providerId)).get()
        : db
            .select()
            .from(epicGame)
            .where(eq(epicGame.epicId, providerId))
            .get();
  if (!providerRow) {
    throw new Error(`No ${provider} game ${providerId}`);
  }
  const previousGameId = providerRow.gameId;
  const previousGame = db
    .select()
    .from(game)
    .where(eq(game.id, previousGameId))
    .get();
  if (!previousGame) {
    throw new Error(`Game ${previousGameId} not found`);
  }
  if (countProviderRows(previousGameId) === 1) {
    return previousGame;
  }
  const splitOffGame = db.transaction((tx) => {
    const createdGame = tx
      .insert(game)
      .values({ name: providerRow.name, hidden: previousGame.hidden })
      .returning()
      .get();
    if (provider === "steam") {
      tx.update(steamGame)
        .set({ gameId: createdGame.id })
        .where(eq(steamGame.appId, providerId))
        .run();
    } else if (provider === "gog") {
      tx.update(gogGame)
        .set({ gameId: createdGame.id })
        .where(eq(gogGame.gogId, providerId))
        .run();
    } else {
      tx.update(epicGame)
        .set({ gameId: createdGame.id })
        .where(eq(epicGame.epicId, providerId))
        .run();
    }
    return createdGame;
  });
  await refreshGameAggregates(previousGameId);
  return await refreshGameAggregates(splitOffGame.id);
}
