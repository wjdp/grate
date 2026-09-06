import fs from "node:fs";
import sharp from "sharp";
import type { ArtKey } from "#shared/art/types";
import { checkFileExists } from "~~/server/files";
import { ensureArtCached } from "./cache";
import { artDirectory, artVariantFilePath } from "./paths";

// Widths the wall and grid actually paint at, doubled for high density
// displays. Anything else is rejected so a caller cannot fill the cache with
// arbitrary sizes.
export const ART_VARIANT_WIDTHS = [240, 480] as const;
export type ArtVariantWidth = (typeof ART_VARIANT_WIDTHS)[number];

const VARIANT_QUALITY = 80;

const inFlightVariants = new Map<string, Promise<string>>();

function variantCacheKey({ provider, id, type }: ArtKey, width: number) {
  return `${provider}/${id}/${type}/w${width}`;
}

async function writeVariant(
  key: ArtKey,
  width: ArtVariantWidth,
): Promise<string> {
  const originalPath = await ensureArtCached(key);
  const path = artVariantFilePath(key, width);
  if (await checkFileExists(path)) {
    return path;
  }
  const body = await sharp(originalPath)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: VARIANT_QUALITY })
    .toBuffer();
  await fs.promises.mkdir(artDirectory(key), { recursive: true });
  // Write then rename so a concurrent reader never sees a partial file.
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await fs.promises.writeFile(temporaryPath, body);
  await fs.promises.rename(temporaryPath, path);
  return path;
}

// Returns the path of a resized WebP copy of the cached original, generating
// it on first request. The original's fetch, negative caching and errors are
// handled by ensureArtCached and propagate unchanged.
export async function ensureArtVariantCached(
  key: ArtKey,
  width: ArtVariantWidth,
): Promise<string> {
  const path = artVariantFilePath(key, width);
  if (await checkFileExists(path)) {
    return path;
  }
  const inFlightKey = variantCacheKey(key, width);
  const inFlight = inFlightVariants.get(inFlightKey);
  if (inFlight) {
    return inFlight;
  }
  const generating = writeVariant(key, width).finally(() => {
    inFlightVariants.delete(inFlightKey);
  });
  inFlightVariants.set(inFlightKey, generating);
  return generating;
}

// Warms every variant width for a key, used by the bulk art cache task so the
// first wall paint does not pay for the resizes.
export async function ensureArtVariantsCached(key: ArtKey): Promise<string[]> {
  const paths: string[] = [];
  for (const width of ART_VARIANT_WIDTHS) {
    paths.push(await ensureArtVariantCached(key, width));
  }
  return paths;
}
