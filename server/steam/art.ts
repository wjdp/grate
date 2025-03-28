import { getSteamArtUrls } from "~/lib/steam/art";
import type { SteamArtUrls } from "~/lib/steam/art";
import fs from "fs";
import sleep from "~/utils/sleep";
import { ART_DIR } from "~/server/constants";
import { checkFileExists } from "~/server/files";

const ART_FETCH_PER_MINUTE = 600;
const TIME_PER_ART_FETCH = 60_000 / ART_FETCH_PER_MINUTE;

function getFilePathForArt(appId: bigint, type: keyof SteamArtUrls) {
  return `${ART_DIR}/steam/${appId}/${type}.jpg`;
}

export async function isSteamArtCached(appId: bigint): Promise<boolean> {
  const art = getSteamArtUrls(appId);
  for (const key of Object.keys(art) as (keyof SteamArtUrls)[]) {
    const artPath = getFilePathForArt(appId, key);
    if (await checkFileExists(artPath)) {
      return true;
    }
  }
  return false;
}

async function cacheArt(appId: bigint, type: keyof SteamArtUrls) {
  const artUrl = getSteamArtUrls(appId)[type];
  const filePath = getFilePathForArt(appId, type);
  const fileDirectory = filePath.split("/").slice(0, -1).join("/");
  const artResponse = await fetch(artUrl);
  const buffer = Buffer.from(await artResponse.arrayBuffer());
  await fs.promises.mkdir(fileDirectory, { recursive: true });
  await fs.promises.writeFile(filePath, buffer);
}

export async function cacheSteamArtForApp(appId: bigint) {
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

export async function checkAndReturnSteamArtPath(
  appId: bigint,
  type: keyof SteamArtUrls,
): Promise<string | null> {
  const filePath = getFilePathForArt(appId, type);
  const exists = await checkFileExists(filePath);
  if (!exists) {
    return null;
  }
  return filePath;
}
