import { and, asc, desc, eq } from "drizzle-orm";
import { normaliseGameName } from "#shared/utils/normaliseGameName";
import {
  epicGame,
  type GameDistinctPair,
  game,
  gameDistinctPair,
  gogGame,
  steamGame,
} from "~~/db/schema";
import { db } from "~~/lib/db";

const providerRowsWithAppInfo = {
  steamGames: { orderBy: asc(steamGame.appId), with: { appInfo: true } },
  gogGames: { orderBy: asc(gogGame.gogId) },
  epicGames: { orderBy: asc(epicGame.epicId) },
} as const;

type GameWithProviderRows = Awaited<
  ReturnType<typeof loadGamesWithProviderRows>
>[number];

export type DuplicateCandidate = GameWithProviderRows & {
  releaseYear: number | null;
};

export interface DuplicateCandidatePair {
  a: DuplicateCandidate;
  b: DuplicateCandidate;
}

function loadGamesWithProviderRows() {
  return db.query.game.findMany({ with: providerRowsWithAppInfo });
}

function releaseYearOf(candidate: GameWithProviderRows): number | null {
  const dates = [
    ...candidate.steamGames.map((row) => row.appInfo?.releaseDate),
    ...candidate.gogGames.map((row) => row.releaseDate),
    ...candidate.epicGames.map((row) => row.releaseDate),
  ].filter((date): date is Date => date instanceof Date);
  if (dates.length === 0) {
    return null;
  }
  return Math.min(...dates.map((date) => date.getFullYear()));
}

function pairKey(gameAId: number, gameBId: number) {
  return `${Math.min(gameAId, gameBId)}:${Math.max(gameAId, gameBId)}`;
}

export async function findDuplicatePairs(): Promise<DuplicateCandidatePair[]> {
  const games = await loadGamesWithProviderRows();
  const optedOut = new Set(
    db
      .select()
      .from(gameDistinctPair)
      .all()
      .map((pair) => pairKey(pair.gameAId, pair.gameBId)),
  );

  const buckets = new Map<string, DuplicateCandidate[]>();
  for (const row of games) {
    const key = normaliseGameName(row.name);
    if (key === "") {
      continue;
    }
    const candidate: DuplicateCandidate = {
      ...row,
      releaseYear: releaseYearOf(row),
    };
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(candidate);
    } else {
      buckets.set(key, [candidate]);
    }
  }

  const pairs: DuplicateCandidatePair[] = [];
  for (const bucket of buckets.values()) {
    const ordered = [...bucket].sort((first, second) => first.id - second.id);
    for (let index = 0; index < ordered.length; index += 1) {
      for (let other = index + 1; other < ordered.length; other += 1) {
        const a = ordered[index];
        const b = ordered[other];
        if (optedOut.has(pairKey(a.id, b.id))) {
          continue;
        }
        pairs.push({ a, b });
      }
    }
  }

  return pairs.sort(
    (first, second) =>
      first.a.name.localeCompare(second.a.name) || first.a.id - second.a.id,
  );
}

export interface DistinctPairSummary {
  id: number;
  createdAt: Date;
  a: { id: number; name: string };
  b: { id: number; name: string };
}

export async function getDistinctPairs(): Promise<DistinctPairSummary[]> {
  const pairs = db
    .select()
    .from(gameDistinctPair)
    .orderBy(desc(gameDistinctPair.createdAt), desc(gameDistinctPair.id))
    .all();
  const names = new Map(
    db
      .select({ id: game.id, name: game.name })
      .from(game)
      .all()
      .map((row) => [row.id, row.name]),
  );
  return pairs.map((pair) => ({
    id: pair.id,
    createdAt: pair.createdAt,
    a: { id: pair.gameAId, name: names.get(pair.gameAId) ?? "" },
    b: { id: pair.gameBId, name: names.get(pair.gameBId) ?? "" },
  }));
}

export async function markDistinct(
  gameAId: number,
  gameBId: number,
): Promise<GameDistinctPair> {
  if (gameAId === gameBId) {
    throw new Error("Cannot mark a game as distinct from itself");
  }
  for (const id of [gameAId, gameBId]) {
    const existing = db.select().from(game).where(eq(game.id, id)).get();
    if (!existing) {
      throw new Error(`Game ${id} not found`);
    }
  }
  const values = {
    gameAId: Math.min(gameAId, gameBId),
    gameBId: Math.max(gameAId, gameBId),
  };
  const inserted = db
    .insert(gameDistinctPair)
    .values(values)
    .onConflictDoNothing()
    .returning()
    .get();
  if (inserted) {
    return inserted;
  }
  const existing = db
    .select()
    .from(gameDistinctPair)
    .where(
      and(
        eq(gameDistinctPair.gameAId, values.gameAId),
        eq(gameDistinctPair.gameBId, values.gameBId),
      ),
    )
    .get();
  if (!existing) {
    throw new Error("Failed to mark games as distinct");
  }
  return existing;
}

export async function unmarkDistinct(id: number): Promise<void> {
  const deleted = db
    .delete(gameDistinctPair)
    .where(eq(gameDistinctPair.id, id))
    .returning()
    .get();
  if (!deleted) {
    throw new Error(`Distinct pair ${id} not found`);
  }
}
