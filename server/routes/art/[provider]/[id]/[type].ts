import fs from "node:fs";
import { z } from "zod";
import {
  ART_PROVIDERS,
  ART_TYPES_BY_PROVIDER,
  ART_VARIANT_WIDTHS,
  ArtFetchError,
  type ArtProvider,
  ArtSourceNotFoundError,
  artConditionalHeaders,
  contentTypeForPath,
  EPIC_ART_ID_PATTERN,
  ensureArtCached,
  ensureArtVariantCached,
  isNotModified,
} from "~~/server/services/art";

const ProviderSchema = z.enum(ART_PROVIDERS);

// Steam and GOG art is keyed on their numeric store ids, Epic art on the
// catalogue item id.
const StoreNumberIdSchema = z.coerce.number().int().positive();

const ID_SCHEMA_BY_PROVIDER = {
  steam: StoreNumberIdSchema,
  gog: StoreNumberIdSchema,
  epic: z.string().regex(EPIC_ART_ID_PATTERN),
} satisfies Record<ArtProvider, z.ZodType<number | string>>;

const WidthSchema = z
  .union([z.literal(ART_VARIANT_WIDTHS[0]), z.literal(ART_VARIANT_WIDTHS[1])])
  .optional();

export default defineEventHandler(async (event) => {
  const parsedProvider = ProviderSchema.safeParse(
    getRouterParam(event, "provider"),
  );
  if (!parsedProvider.success) {
    setResponseStatus(event, 400);
    return { error: "Invalid parameters" };
  }
  const provider = parsedProvider.data;
  const parsedId = ID_SCHEMA_BY_PROVIDER[provider].safeParse(
    getRouterParam(event, "id"),
  );
  if (!parsedId.success) {
    setResponseStatus(event, 400);
    return { error: "Invalid parameters" };
  }
  const id = parsedId.data;

  const type = z
    .enum(ART_TYPES_BY_PROVIDER[provider])
    .safeParse(getRouterParam(event, "type"));
  if (!type.success) {
    setResponseStatus(event, 400);
    return { error: "Invalid parameters" };
  }

  const requestedWidth = getQuery(event).w;
  const width = WidthSchema.safeParse(
    requestedWidth === undefined ? undefined : Number(requestedWidth),
  );
  if (!width.success) {
    setResponseStatus(event, 400);
    return { error: "Invalid width" };
  }

  const key = { provider, id, type: type.data };
  let filePath: string;
  try {
    filePath = width.data
      ? await ensureArtVariantCached(key, width.data)
      : await ensureArtCached(key);
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

  const cacheHeaders = await artConditionalHeaders(filePath);
  for (const [header, value] of Object.entries(cacheHeaders)) {
    setResponseHeader(event, header, value);
  }
  const contentType = contentTypeForPath(filePath);
  if (contentType) {
    setResponseHeader(event, "Content-Type", contentType);
  }
  if (
    isNotModified(cacheHeaders, {
      ifNoneMatch: getRequestHeader(event, "if-none-match"),
      ifModifiedSince: getRequestHeader(event, "if-modified-since"),
    })
  ) {
    setResponseStatus(event, 304);
    return null;
  }
  return sendStream(event, fs.createReadStream(filePath));
});
