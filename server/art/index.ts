import { deriveEpicIcon } from "./epicIcon";
import {
  ArtFetchError,
  ArtNegativelyCachedError,
  ArtSourceNotFoundError,
  fetchImage,
  writeArtFile,
} from "./fetch";
import { hasFreshMissingMarker, writeMissingMarker } from "./missing";
import { findCachedArtFile } from "./paths";
import { waitForArtFetchSlot } from "./rateLimit";
import { resolveArtSources } from "./sources";
import type { ArtKey } from "./types";

export { ArtFetchError, ArtNegativelyCachedError, ArtSourceNotFoundError };
export { contentTypeForPath, findCachedArtFile } from "./paths";
export * from "./types";

const inFlightFetches = new Map<string, Promise<string>>();

function cacheKey({ provider, id, type }: ArtKey) {
  return `${provider}/${id}/${type}`;
}

async function fetchAndWrite(
  key: ArtKey,
  { rateLimit }: { rateLimit: boolean },
): Promise<string> {
  const sources = await resolveArtSources(key);
  // A key with no sources at all has nothing to negative-cache: resolving it
  // costs a DB read at most, so no marker is written.
  if (sources.length === 0) {
    throw new ArtSourceNotFoundError(`No art source for ${cacheKey(key)}`);
  }
  for (const source of sources) {
    if (rateLimit) {
      await waitForArtFetchSlot(source.url);
    }
    let image;
    try {
      image = await fetchImage(source.url);
    } catch (error) {
      if (error instanceof ArtSourceNotFoundError) {
        continue;
      }
      throw error;
    }
    return writeArtFile(
      key,
      source.derive === "epicIcon" ? await deriveEpicIcon(image) : image,
    );
  }
  await writeMissingMarker(key);
  throw new ArtSourceNotFoundError(`Upstream has no art for ${cacheKey(key)}`);
}

// Returns the path of the cached file, fetching it from the provider CDN when
// it is missing. Throws ArtSourceNotFoundError when the provider has no such
// art, ArtFetchError when the fetch or its validation failed.
export async function ensureArtCached(
  key: ArtKey,
  { rateLimit = false }: { rateLimit?: boolean } = {},
): Promise<string> {
  const cached = await findCachedArtFile(key);
  if (cached) {
    return cached;
  }
  if (await hasFreshMissingMarker(key)) {
    throw new ArtNegativelyCachedError(
      `Upstream had no art for ${cacheKey(key)} when last checked`,
    );
  }
  const inFlightKey = cacheKey(key);
  const inFlight = inFlightFetches.get(inFlightKey);
  if (inFlight) {
    return inFlight;
  }
  const fetching = fetchAndWrite(key, { rateLimit }).finally(() => {
    inFlightFetches.delete(inFlightKey);
  });
  inFlightFetches.set(inFlightKey, fetching);
  return fetching;
}
