import { cacheSteamArtForApp, isSteamArtCached } from "~/server/steam/art";
import prisma from "~/lib/prisma";
import { cacheSteamIconForApp, isSteamIconCached } from "~/server/steam/icon";

async function cacheArtForSingleGame(appId: number) {
  const isCached = await isSteamArtCached(appId);
  if (!isCached) {
    console.log(`Caching steam art for app ${appId}`);
    await cacheSteamArtForApp(appId);
  }
}

async function cacheIconForSingleGame(steamGame: SteamGame) {
  const isCached = await isSteamIconCached(steamGame.appId);
  if (!isCached) {
    console.log(`Caching steam icon for app ${steamGame.appId}`);
    await cacheSteamIconForApp(steamGame);
  }
}

export default async function cacheSteamArt() {
  const steamGames = await prisma.steamGame.findMany();
  for (const game of steamGames) {
    await cacheArtForSingleGame(game.appId as number);
    await cacheIconForSingleGame(game);
  }
}
