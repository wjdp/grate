import mapWithConcurrency from "#shared/utils/mapWithConcurrency";
import type { ArtProvider } from "~~/server/art";
import {
  ART_TYPES_BY_PROVIDER,
  ArtFetchError,
  ArtNegativelyCachedError,
  ArtSourceNotFoundError,
  ensureArtCached,
} from "~~/server/art";
import { db } from "~~/server/database/client";
import { epicGame, gogGame, steamGame } from "~~/server/database/schema";
import type { Task } from "~~/server/tasks/queue";
import { updateInProgressTask } from "~~/server/tasks/queue";

const CACHE_ART_CONCURRENCY = 8;

async function cacheArtForGame(provider: ArtProvider, id: number) {
  for (const type of ART_TYPES_BY_PROVIDER[provider]) {
    try {
      await ensureArtCached({ provider, id, type }, { rateLimit: true });
    } catch (error) {
      // A recorded miss is already done as far as the bulk task is concerned.
      if (error instanceof ArtNegativelyCachedError) {
        continue;
      }
      if (
        error instanceof ArtSourceNotFoundError ||
        error instanceof ArtFetchError
      ) {
        console.error(
          `No ${provider} ${type} art for id ${id}: ${error.message}`,
        );
        continue;
      }
      throw error;
    }
  }
}

export default async (task: Task) => {
  const rows: { provider: ArtProvider; id: number; name: string }[] = [
    ...db
      .select()
      .from(steamGame)
      .all()
      .map((row) => ({
        provider: "steam" as const,
        id: row.appId,
        name: row.name,
      })),
    ...db
      .select()
      .from(gogGame)
      .all()
      .map((row) => ({
        provider: "gog" as const,
        id: row.gogId,
        name: row.name,
      })),
    ...db
      .select()
      .from(epicGame)
      .all()
      .map((row) => ({
        provider: "epic" as const,
        id: row.epicId,
        name: row.name,
      })),
  ];

  const numRows = rows.length;
  let done = 0;
  await mapWithConcurrency(rows, CACHE_ART_CONCURRENCY, async (row) => {
    await cacheArtForGame(row.provider, row.id);
    done++;
    await updateInProgressTask(task, {
      progress: done / numRows,
      done,
      total: numRows,
      message: `Cached art for ${row.name}`,
    });
  });
};
