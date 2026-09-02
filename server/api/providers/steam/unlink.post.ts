import { unlinkSteamAccount } from "~~/lib/steam/service";

export default defineEventHandler(async () => {
  await unlinkSteamAccount();
  return { ok: true };
});
