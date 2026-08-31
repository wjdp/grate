import { deriveEpicIcon } from "./epicIcon";
import {
  ArtFetchError,
  ArtSourceNotFoundError,
  fetchImage,
  writeArtFile,
} from "./fetch";
import { findCachedArtFile } from "./paths";
import { waitForArtFetchSlot } from "./rateLimit";
import { resolveArtSource } from "./sources";
import type { ArtKey } from "./types";

export { ArtFetchError, ArtSourceNotFoundError };
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
  const source = await resolveArtSource(key);
  if (!source) {
    throw new ArtSourceNotFoundError(`No art source for ${cacheKey(key)}`);
  }
  if (rateLimit) {
    await waitForArtFetchSlot(source.url);
  }
  const image = await fetchImage(source.url);
  return writeArtFile(
    key,
    source.derive === "epicIcon" ? await deriveEpicIcon(image) : image,
  );
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
