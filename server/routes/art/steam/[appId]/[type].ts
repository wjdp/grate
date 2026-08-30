import { z } from "zod";
import {
  checkAndReturnSteamArtPath,
  STEAM_ART_TYPES,
} from "~/server/steam/art";
import fs from "fs";

const PathSchema = z.object({
  appId: z.coerce.number().int().positive(),
  type: z.enum(STEAM_ART_TYPES),
});

export default defineEventHandler(async (event) => {
  const params = PathSchema.safeParse({
    appId: getRouterParam(event, "appId"),
    type: getRouterParam(event, "type"),
  });

  if (params.error) {
    setResponseStatus(event, 400);
    return { error: "Invalid parameters" };
  }

  const cachedArtFilePath = await checkAndReturnSteamArtPath(
    params.data.appId,
    params.data.type,
  );
  if (!cachedArtFilePath) {
    setResponseStatus(event, 404);
    return { error: "Not found" };
  }

  setResponseHeader(event, "Cache-Control", "public, max-age=3600");
  return sendStream(event, fs.createReadStream(cachedArtFilePath));
});
