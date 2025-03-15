import { ART_DIR } from "~/server/constants";
import { checkFileExists } from "~/server/files";
import type { SteamGame } from "@prisma/client";
import fs from "fs";

function getFilePathForIcon(appId: bigint) {
  return `${ART_DIR}/steam/${appId}/icon.jpg`;
}

export async function isSteamIconCached(appId: bigint): Promise<boolean> {
  return await checkFileExists(getFilePathForIcon(appId));
}

function getSteamIconUrl(steamGame: SteamGame) {
  return `http://media.steampowered.com/steamcommunity/public/images/apps/${steamGame.appId}/${steamGame.imgIconUrl}.jpg`;
}

export async function cacheSteamIconForApp(steamGame: SteamGame) {
  const iconUrl = getSteamIconUrl(steamGame);
  const filePath = getFilePathForIcon(steamGame.appId);
  const fileDirectory = filePath.split("/").slice(0, -1).join("/");
  const artResponse = await fetch(iconUrl);
  const buffer = Buffer.from(await artResponse.arrayBuffer());
  await fs.promises.mkdir(fileDirectory, { recursive: true });
  await fs.promises.writeFile(filePath, buffer);
}
