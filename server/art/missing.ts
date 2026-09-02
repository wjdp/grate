import fs from "node:fs";
import type { ArtKey } from "#shared/art/types";
import { artDirectory, artMissingMarkerPath } from "./paths";

export const MISSING_MARKER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// An empty marker file records that every upstream candidate reported the
// asset absent, so renders of art that genuinely does not exist stop hitting
// the CDN. Markers expire so art added upstream later is picked up.
export async function hasFreshMissingMarker(key: ArtKey): Promise<boolean> {
  const path = artMissingMarkerPath(key);
  let mtimeMs: number;
  try {
    ({ mtimeMs } = await fs.promises.stat(path));
  } catch {
    return false;
  }
  if (Date.now() - mtimeMs < MISSING_MARKER_MAX_AGE_MS) {
    return true;
  }
  await clearMissingMarker(key);
  return false;
}

export async function writeMissingMarker(key: ArtKey): Promise<string> {
  const path = artMissingMarkerPath(key);
  await fs.promises.mkdir(artDirectory(key), { recursive: true });
  await fs.promises.writeFile(path, "");
  return path;
}

export async function clearMissingMarker(key: ArtKey): Promise<void> {
  await fs.promises.rm(artMissingMarkerPath(key), { force: true });
}
