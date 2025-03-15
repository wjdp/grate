import { cacheSteamArtForApp, isSteamArtCached } from "~/server/steam/art";
import prisma from "~/lib/prisma";
import { cacheSteamIconForApp, isSteamIconCached } from "~/server/steam/icon";
import { updateInProgressTask } from "~/server/tasks/queue";
import type { Task } from "~/server/tasks/queue";
import type { SteamGame } from "@prisma/client";

async function cacheArtForSingleGame(task: Task, appId: number) {
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

export default async function cacheSteamArt(task: Task) {
  const steamGames = await prisma.steamGame.findMany();
  const numGames = steamGames.length;
  let i = 0;
  for (const game of steamGames) {
    await cacheArtForSingleGame(task, game.appId as number);
    await cacheIconForSingleGame(task, game);
    await updateInProgressTask(task, {
      progress: i / numGames,
      message: `Cached art for ${game.name}`,
    });
    i++;
  }
}
