import { cacheSteamArtForApp, isSteamArtCached } from "~/server/steam/art";
import prisma from "~/lib/prisma";

async function cacheArtForSingleGame(appId: number) {
  const isCached = await isSteamArtCached(appId);
  if (!isCached) {
    console.log(`Caching steam art for app ${appId}`);
    await cacheSteamArtForApp(appId);
  }
}

export default async function cacheSteamArt() {
  const steamGames = await prisma.steamGame.findMany();
  for (const game of steamGames) {
    await cacheArtForSingleGame(game.appId as number);
  }
}
