import { getSteamUser } from "~~/server/providers/steam/service";
import { getWebSessionActivity } from "~~/server/providers/steam/webSession";

export default defineEventHandler(async () => {
  const steamUser = await getSteamUser();
  if (!steamUser) return null;
  const { lastUsedAt, lastError } = getWebSessionActivity();
  return {
    steamId: steamUser.steamId,
    personaName: steamUser.personaName,
    hasApiKey: !!steamUser.apiKey,
    webSessionExpiresAt: steamUser.refreshTokenExpiresAt?.toISOString() ?? null,
    webSessionLastUsedAt: lastUsedAt?.toISOString() ?? null,
    webSessionLastError: lastError,
  };
});
