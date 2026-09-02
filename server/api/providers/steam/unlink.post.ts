import { unlinkSteamAccount } from "~~/server/providers/steam/service";

export default defineEventHandler(async () => {
  await unlinkSteamAccount();
  return { ok: true };
});
