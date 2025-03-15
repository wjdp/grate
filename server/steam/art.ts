import { getSteamArtUrls, SteamArtUrls } from "~/lib/steam/art";
import fs from "fs";
import sleep from "~/utils/sleep";
import { ART_DIR } from "~/server/constants";
import { checkFileExists } from "~/server/files";

const TIME_PER_ART_FETCH = 600;

function getFilePathForArt(appId: number, type: keyof SteamArtUrls) {
  return `${ART_DIR}/steam/${appId}/${type}.jpg`;
}

export async function isSteamArtCached(appId: number): Promise<boolean> {
  const art = getSteamArtUrls(appId);
  for (const key of Object.keys(art) as (keyof SteamArtUrls)[]) {
    const artPath = getFilePathForArt(appId, key);
    if (await checkFileExists(artPath)) {
      return true;
    }
  }
  return false;
}

async function cacheArt(appId: number, type: keyof SteamArtUrls) {
  const artUrl = getSteamArtUrls(appId)[type];
  const filePath = getFilePathForArt(appId, type);
  const fileDirectory = filePath.split("/").slice(0, -1).join("/");
  const artResponse = await fetch(artUrl);
  const buffer = Buffer.from(await artResponse.arrayBuffer());
  await fs.promises.mkdir(fileDirectory, { recursive: true });
  await fs.promises.writeFile(filePath, buffer);
}

export async function cacheSteamArtForApp(appId: number) {
  const art = getSteamArtUrls(appId);
  for (const key of Object.keys(art) as (keyof SteamArtUrls)[]) {
    const timeBefore = performance.now();
    await cacheArt(appId, key);
    const timeAfter = performance.now();
    // Limit our requests so we don't get rate limited
    const timeTaken = timeAfter - timeBefore;
    const timeToWait = TIME_PER_ART_FETCH - timeTaken;
    if (timeToWait > 0) {
      await sleep(timeToWait);
    }
  }
}
