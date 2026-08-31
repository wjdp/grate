import fs from "node:fs";
import { z } from "zod";
import {
  ART_PROVIDERS,
  ART_TYPES_BY_PROVIDER,
  ArtFetchError,
  ArtSourceNotFoundError,
  contentTypeForPath,
  ensureArtCached,
} from "~~/server/art";

const ProviderAndIdSchema = z.object({
  provider: z.enum(ART_PROVIDERS),
  id: z.coerce.number().int().positive(),
});

export default defineEventHandler(async (event) => {
  const providerAndId = ProviderAndIdSchema.safeParse({
    provider: getRouterParam(event, "provider"),
    id: getRouterParam(event, "id"),
  });
  if (!providerAndId.success) {
    setResponseStatus(event, 400);
    return { error: "Invalid parameters" };
  }
  const { provider, id } = providerAndId.data;

  const type = z
    .enum(ART_TYPES_BY_PROVIDER[provider])
    .safeParse(getRouterParam(event, "type"));
  if (!type.success) {
    setResponseStatus(event, 400);
    return { error: "Invalid parameters" };
  }

  let filePath: string;
  try {
    filePath = await ensureArtCached({ provider, id, type: type.data });
  } catch (error) {
    if (error instanceof ArtSourceNotFoundError) {
      setResponseStatus(event, 404);
      setResponseHeader(event, "Cache-Control", "public, max-age=60");
      return { error: "Not found" };
    }
    if (error instanceof ArtFetchError) {
      console.error(`Could not cache art for ${provider}/${id}: ${error}`);
      setResponseStatus(event, 502);
      return { error: "Could not fetch art" };
    }
    throw error;
  }

  const contentType = contentTypeForPath(filePath);
  if (contentType) {
    setResponseHeader(event, "Content-Type", contentType);
  }
  setResponseHeader(event, "Cache-Control", "public, max-age=3600");
  return sendStream(event, fs.createReadStream(filePath));
});
