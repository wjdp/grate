import prisma from "~/lib/prisma";

import * as child_process from "node:child_process";

const TABLES = [
  "SteamGamePlaytime",
  "GogGamePlaytime",
  "GameStateChange",
  "SteamUser",
  "GogIgnoredProduct",
  "SteamAppInfo",
  "SteamGame",
  "GogGame",
  "Game",
  "User",
  "GogUser",
];

export async function flushDb() {
  for (const table of TABLES) {
    await prisma.$executeRawUnsafe(`delete from ${table};`);
  }
}

export async function resetDb() {
  const command = "npx prisma migrate reset --force --skip-seed";
  child_process.execSync(command, { stdio: "inherit" });
}
