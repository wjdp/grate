import { db } from "~~/lib/db";
import { steamGame } from "~~/db/schema";
import { updateInProgressTask } from "~~/server/tasks/queue";
import type { Task } from "~~/server/tasks/queue";
import {
  ArtFetchError,
  ArtSourceNotFoundError,
  ensureArtCached,
  STEAM_ART_TYPES,
} from "~~/server/art";

async function cacheArtForApp(appId: number) {
  for (const type of STEAM_ART_TYPES) {
    try {
      await ensureArtCached(
        { provider: "steam", id: appId, type },
        { rateLimit: true },
      );
    } catch (error) {
      if (
        error instanceof ArtSourceNotFoundError ||
        error instanceof ArtFetchError
      ) {
        console.log(`No steam ${type} art for app ${appId}: ${error.message}`);
        continue;
      }
      throw error;
    }
  }
}

export default async (task: Task) => {
  const steamGames = db.select().from(steamGame).all();
  const numGames = steamGames.length;
  let i = 0;
  for (const game of steamGames) {
    await cacheArtForApp(game.appId);
    await updateInProgressTask(task, {
      progress: i / numGames,
      message: `Cached art for ${game.name}`,
    });
    i++;
  }
};
