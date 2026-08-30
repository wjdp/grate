import { getSteamUser } from "~~/lib/steam/service";

export default defineEventHandler(async () => {
  const steamUser = await getSteamUser();
  if (!steamUser) return null;
  return {
    steamId: steamUser.steamId,
    personaName: steamUser.personaName,
    hasApiKey: !!steamUser.apiKey,
  };
});
