import { existsSync, mkdtempSync, readFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import createFetchMock from "vitest-fetch-mock";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const dataDir = mkdtempSync(join(tmpdir(), "grate-art-ensure-"));
vi.stubEnv("DATA_DIR", dataDir);

const sources = vi.hoisted(() => ({ candidates: [] as { url: string }[] }));
vi.mock("./sources", () => ({
  resolveArtSources: async () => sources.candidates,
}));

const {
  ensureArtCached,
  ArtFetchError,
  ArtNegativelyCachedError,
  ArtSourceNotFoundError,
} = await import("./index");
const { artFilePath, artMissingMarkerPath } = await import("./paths");
const { MISSING_MARKER_MAX_AGE_MS, writeMissingMarker } = await import(
  "./missing"
);

const fetchMocker = createFetchMock(vi);
fetchMocker.enableMocks();

const FIRST = "https://cdn.example/first.jpg";
const SECOND = "https://cdn.example/second.jpg";
const THIRD = "https://cdn.example/third.jpg";

function imageResponse(body: string) {
  return { body, headers: { "content-type": "image/jpeg" } };
}

function notFound() {
  return { body: "nope", status: 404 };
}

let nextId = 1;
function nextKey() {
  return { provider: "steam", id: nextId++, type: "poster" } as const;
}

describe("ensureArtCached", () => {
  beforeEach(() => {
    fetchMocker.resetMocks();
    sources.candidates = [{ url: FIRST }, { url: SECOND }, { url: THIRD }];
  });
  afterAll(() => {
    fetchMocker.disableMocks();
  });

  it("caches the first candidate the CDN serves, under the requested type", async () => {
    fetchMocker.mockResponses(notFound(), imageResponse("second bytes"));
    const key = nextKey();

    const path = await ensureArtCached(key);

    expect(path).toBe(artFilePath(key, "jpg"));
    expect(readFileSync(path).toString()).toBe("second bytes");
    expect(fetchMocker.requests().map((request) => request.url)).toEqual([
      FIRST,
      SECOND,
    ]);
    expect(existsSync(artMissingMarkerPath(key))).toBe(false);
  });

  it("writes a marker and 404s once every candidate misses", async () => {
    fetchMocker.mockResponses(notFound(), notFound(), notFound());
    const key = nextKey();

    await expect(ensureArtCached(key)).rejects.toBeInstanceOf(
      ArtSourceNotFoundError,
    );
    expect(existsSync(artMissingMarkerPath(key))).toBe(true);
    expect(fetchMocker.requests()).toHaveLength(3);
  });

  it("throws from a fresh marker without touching the network", async () => {
    const key = nextKey();
    await writeMissingMarker(key);

    await expect(ensureArtCached(key)).rejects.toBeInstanceOf(
      ArtNegativelyCachedError,
    );
    expect(fetchMocker.requests()).toHaveLength(0);
  });

  it("retries and clears the marker once it is older than the max age", async () => {
    const key = nextKey();
    const marker = await writeMissingMarker(key);
    const aged = (Date.now() - MISSING_MARKER_MAX_AGE_MS - 60_000) / 1000;
    utimesSync(marker, aged, aged);
    fetchMocker.mockResponses(imageResponse("fresh bytes"));

    const path = await ensureArtCached(key);

    expect(readFileSync(path).toString()).toBe("fresh bytes");
    expect(existsSync(marker)).toBe(false);
  });

  it("writes no marker when the key has no source at all", async () => {
    sources.candidates = [];
    const key = nextKey();

    await expect(ensureArtCached(key)).rejects.toBeInstanceOf(
      ArtSourceNotFoundError,
    );
    expect(existsSync(artMissingMarkerPath(key))).toBe(false);
    expect(fetchMocker.requests()).toHaveLength(0);
  });

  it("writes no marker when a candidate fails for another reason", async () => {
    fetchMocker.mockResponses(notFound(), { body: "boom", status: 500 });
    const key = nextKey();

    await expect(ensureArtCached(key)).rejects.toBeInstanceOf(ArtFetchError);
    expect(existsSync(artMissingMarkerPath(key))).toBe(false);
  });
});
