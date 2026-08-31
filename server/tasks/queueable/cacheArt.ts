import { db } from "~~/lib/db";
import { steamGame, gogGame, epicGame } from "~~/db/schema";
import { updateInProgressTask } from "~~/server/tasks/queue";
import type { Task } from "~~/server/tasks/queue";
import {
  ART_TYPES_BY_PROVIDER,
  ArtFetchError,
  ArtSourceNotFoundError,
  ensureArtCached,
} from "~~/server/art";
import type { ArtProvider } from "~~/server/art";

async function cacheArtForGame(provider: ArtProvider, id: number) {
  for (const type of ART_TYPES_BY_PROVIDER[provider]) {
    try {
      await ensureArtCached({ provider, id, type }, { rateLimit: true });
    } catch (error) {
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
  let i = 0;
  for (const row of rows) {
    await cacheArtForGame(row.provider, row.id);
    await updateInProgressTask(task, {
      progress: i / numRows,
      message: `Cached art for ${row.name}`,
    });
    i++;
  }
};
