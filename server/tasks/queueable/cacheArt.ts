import mapWithConcurrency from "#shared/utils/mapWithConcurrency";
import { db } from "~~/server/database/client";
import { epicGame, gogGame, steamGame } from "~~/server/database/schema";
import type { ArtProvider } from "~~/server/services/art";
import {
  ART_TYPES_BY_PROVIDER,
  ArtFetchError,
  ArtNegativelyCachedError,
  ArtSourceNotFoundError,
  ensureArtCached,
  ensureArtVariantsCached,
} from "~~/server/services/art";
import type { Task } from "~~/server/tasks/queue";
import { updateInProgressTask } from "~~/server/tasks/queue";

const CACHE_ART_CONCURRENCY = 8;

// Resizing is local work, so it is not rate limited. A single unreadable
// original must not abort the whole bulk run.
async function warmPosterVariants(provider: ArtProvider, id: number | string) {
  try {
    await ensureArtVariantsCached({ provider, id, type: "poster" });
  } catch (error) {
    console.error(
      `Could not generate ${provider} poster variants for id ${id}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function cacheArtForGame(provider: ArtProvider, id: number | string) {
  for (const type of ART_TYPES_BY_PROVIDER[provider]) {
    try {
      await ensureArtCached({ provider, id, type }, { rateLimit: true });
      // Only the wall paints resized art, and only from posters.
      if (type === "poster") {
        await warmPosterVariants(provider, id);
      }
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
  const rows: { provider: ArtProvider; id: number | string; name: string }[] = [
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
        id: row.catalogItemId,
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
