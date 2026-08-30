import { cacheSteamArtForApp, isSteamArtCached } from "~/server/steam/art";
import { db } from "~~/lib/db";
import { cacheSteamIconForApp, isSteamIconCached } from "~/server/steam/icon";
import { updateInProgressTask } from "~/server/tasks/queue";
import type { Task } from "~/server/tasks/queue";
import { steamGame, type SteamGame } from "~~/db/schema";

async function cacheArtForSingleGame(task: Task, appId: bigint) {
  const isCached = await isSteamArtCached(appId);
  if (!isCached) {
    console.log(`Caching steam art for app ${appId}`);
    await cacheSteamArtForApp(appId);
  }
}

async function cacheIconForSingleGame(task: Task, steamGame: SteamGame) {
  const isCached = await isSteamIconCached(steamGame.appId);
  if (!isCached) {
    console.log(`Caching steam icon for app ${steamGame.appId}`);
    await cacheSteamIconForApp(steamGame);
  }
}

export default async (task: Task) => {
  const steamGames = db.select().from(steamGame).all();
  const numGames = steamGames.length;
  let i = 0;
  for (const game of steamGames) {
    await cacheArtForSingleGame(task, game.appId);
    await cacheIconForSingleGame(task, game);
    await updateInProgressTask(task, {
      progress: i / numGames,
      message: `Cached art for ${game.name}`,
    });
    i++;
  }
};
