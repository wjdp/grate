import { removeSteamWebSession } from "~~/server/providers/steam/service";

export default defineEventHandler(async () => {
  await removeSteamWebSession();
  return { ok: true };
});
