import { steamIdentifyBodySchema } from "#shared/schemas/providers";
import { parseSteamProfileInput } from "#shared/steam-profile";
import tryCatch from "#shared/utils/tryCatch";
import { identifySteamAccount } from "~~/server/providers/steam/service";

export default defineEventHandler(async (event) => {
  const { profile } = await readValidatedBody(
    event,
    steamIdentifyBodySchema.parse,
  );
  const parsedProfile = parseSteamProfileInput(profile);
  if (!parsedProfile) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Enter a Steam profile URL, vanity name or SteamID64",
    });
  }
  const { data: identity, error } = await tryCatch(
    identifySteamAccount(parsedProfile),
  );
  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: error.message,
    });
  }
  return identity;
});
