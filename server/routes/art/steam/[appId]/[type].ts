import { z } from "zod";
import { checkAndReturnSteamArtPath } from "~/server/steam/art";
import fs from "fs";

const PathSchema = z.object({
  appId: z.coerce.number().positive(),
  type: z.string(),
});

export default defineEventHandler(async (event) => {
  const params = PathSchema.safeParse({
    appId: getRouterParam(event, "appId"),
    type: getRouterParam(event, "type"),
  });

  const cachedArtFilePath = await checkAndReturnSteamArtPath(
    params.data.appId,
    params.data.type,
  );
  if (!cachedArtFilePath) {
    setResponseStatus(event, 404);
    return { error: "Not found" };
  }

  return sendStream(event, fs.createReadStream(cachedArtFilePath));
});
