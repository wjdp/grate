import fs from "fs";
import { clearMissingMarker } from "./missing";
import {
  artDirectory,
  artFilePath,
  CACHED_ART_EXTENSIONS,
  extensionForContentType,
} from "./paths";
import type { ArtKey } from "./types";

export class ArtSourceNotFoundError extends Error {}
// A miss already recorded on disk: no network call was made for it.
export class ArtNegativelyCachedError extends ArtSourceNotFoundError {}
export class ArtFetchError extends Error {}

export interface FetchedImage {
  body: Buffer;
  contentType: string;
}

export async function fetchImage(url: string): Promise<FetchedImage> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new ArtFetchError(`Could not reach ${url}: ${String(error)}`);
  }
  if (response.status === 404 || response.status === 403) {
    throw new ArtSourceNotFoundError(`Upstream has no art at ${url}`);
  }
  if (!response.ok) {
    throw new ArtFetchError(`Upstream returned ${response.status} for ${url}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new ArtFetchError(
      `Upstream returned ${contentType || "no content type"} for ${url}`,
    );
  }
  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType,
  };
}

export async function writeArtFile(
  key: ArtKey,
  { body, contentType }: FetchedImage,
): Promise<string> {
  const path = artFilePath(key, extensionForContentType(contentType));
  await fs.promises.mkdir(artDirectory(key), { recursive: true });
  // Write then rename so a concurrent reader never sees a partial file.
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await fs.promises.writeFile(temporaryPath, body);
  await fs.promises.rename(temporaryPath, path);
  await removeStaleArtFiles(key, path);
  await clearMissingMarker(key);
  return path;
}

// A refetch can land on a different extension to the one already cached; the
// old file would otherwise win the probe order forever.
async function removeStaleArtFiles(key: ArtKey, keepPath: string) {
  for (const extension of CACHED_ART_EXTENSIONS) {
    const path = artFilePath(key, extension);
    if (path !== keepPath) {
      await fs.promises.rm(path, { force: true });
    }
  }
}
