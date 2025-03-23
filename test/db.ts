import prisma from "~/lib/prisma";

import * as child_process from "node:child_process";

const TABLES = [
  "User",
  "Game",
  "GameStateChange",
  "SteamUser",
  "SteamGame",
  "SteamGamePlaytime",
];

export async function flushDb() {
  const sql = TABLES.map(
    (table) => `delete
                from ${table};`,
  ).join("\n");
  await prisma.$executeRawUnsafe(sql);
}

export async function resetDb() {
  const command = "npx prisma migrate reset --force --skip-seed";
  child_process.execSync(command, { stdio: "inherit" });
}
