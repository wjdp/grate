import { createOrUpdateSteamUser } from "~~/lib/steam/service";
import { steamAuthBodySchema } from "#shared/schemas/providers";
import tryCatch from "#shared/utils/tryCatch";

export default defineEventHandler(async (event) => {
  const credentials = await readValidatedBody(event, steamAuthBodySchema.parse);
  const { data: steamUser, error } = await tryCatch(
    createOrUpdateSteamUser(credentials),
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
