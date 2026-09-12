import { steamAuthBodySchema } from "#shared/schemas/providers";
import tryCatch from "#shared/utils/tryCatch";
import { takeHeldQrLogin } from "~~/server/providers/steam/qrRegistry";
import {
  connectSteamAccount,
  type SteamWebSession,
} from "~~/server/providers/steam/service";

export default defineEventHandler(async (event) => {
  const { apiKey, steamId, qrLoginId } = await readValidatedBody(
    event,
    steamAuthBodySchema.parse,
  );
  let webSession: SteamWebSession | undefined;
  if (qrLoginId) {
    const held = takeHeldQrLogin(qrLoginId);
    if (!held || held.steamId !== steamId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "QR login not found or expired",
      });
    }
    webSession = {
      refreshToken: held.refreshToken,
      refreshTokenExpiresAt: held.refreshTokenExpiresAt,
    };
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
