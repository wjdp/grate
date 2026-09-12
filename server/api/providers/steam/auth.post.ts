import { steamAuthBodySchema } from "#shared/schemas/providers";
import tryCatch from "#shared/utils/tryCatch";
import { takeHeldQrLogin } from "~~/server/providers/steam/qrRegistry";
import {
  connectSteamAccount,
  getSteamUser,
  type SteamWebSession,
} from "~~/server/providers/steam/service";

// The scan may already have attached its token to the row, in which case the
// registry entry is gone and there is nothing left to claim.
async function hasStoredWebSession(steamId: string): Promise<boolean> {
  const currentUser = await getSteamUser();
  return (
    currentUser?.steamId === steamId &&
    !!currentUser.refreshToken &&
    !!currentUser.refreshTokenExpiresAt
  );
}

export default defineEventHandler(async (event) => {
  const { apiKey, steamId, qrLoginId } = await readValidatedBody(
    event,
    steamAuthBodySchema.parse,
  );
  let webSession: SteamWebSession | undefined;
  if (qrLoginId) {
    const held = takeHeldQrLogin(qrLoginId);
    if (held && held.steamId === steamId) {
      webSession = {
        refreshToken: held.refreshToken,
        refreshTokenExpiresAt: held.refreshTokenExpiresAt,
      };
    } else if (!(await hasStoredWebSession(steamId))) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "QR login not found or expired",
      });
    }
  }
  const { data: steamUser, error } = await tryCatch(
    connectSteamAccount({ steamId, apiKey, webSession }),
  );
  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: error.message,
    });
  }
  return {
    steamId: steamUser.steamId,
    personaName: steamUser.personaName,
  };
});
