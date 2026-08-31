import { existsSync, mkdtempSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const dataDir = mkdtempSync(join(tmpdir(), "grate-art-missing-"));
vi.stubEnv("DATA_DIR", dataDir);

const {
  clearMissingMarker,
  hasFreshMissingMarker,
  writeMissingMarker,
  MISSING_MARKER_MAX_AGE_MS,
} = await import("./missing");
const { artMissingMarkerPath } = await import("./paths");

const key = { provider: "steam", id: 201870, type: "poster" } as const;

function ageMarker(path: string, ageMs: number) {
  const seconds = (Date.now() - ageMs) / 1000;
  utimesSync(path, seconds, seconds);
}

describe("missing markers", () => {
  it("reports no marker when none was written", async () => {
    expect(await hasFreshMissingMarker(key)).toBe(false);
  });

  it("writes an empty marker beside where the art would live", async () => {
    const path = await writeMissingMarker(key);
    expect(path).toBe(artMissingMarkerPath(key));
    expect(path.endsWith("/201870/poster.missing")).toBe(true);
    expect(await hasFreshMissingMarker(key)).toBe(true);
  });

  it("keeps a marker younger than the max age", async () => {
    const path = await writeMissingMarker(key);
    ageMarker(path, MISSING_MARKER_MAX_AGE_MS - 60_000);
    expect(await hasFreshMissingMarker(key)).toBe(true);
    expect(existsSync(path)).toBe(true);
  });

  it("deletes a marker older than the max age", async () => {
    const path = await writeMissingMarker(key);
    ageMarker(path, MISSING_MARKER_MAX_AGE_MS + 60_000);
    expect(await hasFreshMissingMarker(key)).toBe(false);
    expect(existsSync(path)).toBe(false);
  });

  it("clears a marker on request", async () => {
    const path = await writeMissingMarker(key);
    await clearMissingMarker(key);
    expect(existsSync(path)).toBe(false);
    await expect(clearMissingMarker(key)).resolves.toBeUndefined();
  });
});
