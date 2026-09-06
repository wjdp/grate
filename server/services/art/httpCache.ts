import type { Stats } from "node:fs";
import fs from "node:fs";

export const ART_MAX_AGE_SECONDS = 86_400;

export interface ConditionalRequestHeaders {
  ifNoneMatch?: string | null;
  ifModifiedSince?: string | null;
}

export interface ArtCacheHeaders {
  "Cache-Control": string;
  ETag: string;
  "Last-Modified": string;
}

function etagForStats(stats: Stats): string {
  return `W/"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
}

export async function artConditionalHeaders(
  path: string,
): Promise<ArtCacheHeaders> {
  const stats = await fs.promises.stat(path);
  return {
    "Cache-Control": `public, max-age=${ART_MAX_AGE_SECONDS}`,
    ETag: etagForStats(stats),
    "Last-Modified": new Date(stats.mtime).toUTCString(),
  };
}

function etagMatches(ifNoneMatch: string, etag: string): boolean {
  return ifNoneMatch
    .split(",")
    .map((candidate) => candidate.trim())
    .some((candidate) => candidate === "*" || candidate === etag);
}

// A client that sends both headers is answered on the ETag alone, as RFC 9110
// requires: the validator is stronger than the second-resolution timestamp.
export function isNotModified(
  headers: ArtCacheHeaders,
  { ifNoneMatch, ifModifiedSince }: ConditionalRequestHeaders,
): boolean {
  if (ifNoneMatch) {
    return etagMatches(ifNoneMatch, headers.ETag);
  }
  if (ifModifiedSince) {
    const since = Date.parse(ifModifiedSince);
    const lastModified = Date.parse(headers["Last-Modified"]);
    return Number.isFinite(since) && lastModified <= since;
  }
  return false;
}
