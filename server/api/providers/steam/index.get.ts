import { getSteamUser } from "~~/lib/steam/service";
import { getSessionRenewal } from "~~/lib/steam/webSession";

export default defineEventHandler(async () => {
  const steamUser = await getSteamUser();
  if (!steamUser) return null;
  const { lastRenewAttemptAt, lastRenewedAt } = getSessionRenewal();
  return {
    steamId: steamUser.steamId,
    personaName: steamUser.personaName,
    sessionExpiresAt: steamUser.refreshTokenExpiresAt?.toISOString() ?? null,
    lastRenewAttemptAt: lastRenewAttemptAt?.toISOString() ?? null,
    lastRenewedAt: lastRenewedAt?.toISOString() ?? null,
  };
});
