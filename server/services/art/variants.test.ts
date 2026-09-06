import { existsSync, mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dataDir = mkdtempSync(join(tmpdir(), "grate-art-variants-"));
vi.stubEnv("DATA_DIR", dataDir);

const { ART_VARIANT_WIDTHS, ensureArtVariantCached } = await import(
  "./variants"
);
const { artFilePath, artVariantFilePath, findCachedArtFile } = await import(
  "./paths"
);
const { writeArtFile } = await import("./fetch");

const key = { provider: "steam", id: 7, type: "poster" } as const;

function poster(width = 600, height = 800) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 9, g: 9, b: 9 } },
  })
    .jpeg()
    .toBuffer();
}

async function cacheOriginal() {
  await writeArtFile(key, { body: await poster(), contentType: "image/jpeg" });
}

describe("ensureArtVariantCached", () => {
  beforeEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
    await cacheOriginal();
  });

  it("writes a webp resized to the requested width", async () => {
    const path = await ensureArtVariantCached(key, 240);
    expect(path).toBe(artVariantFilePath(key, 240));
    const metadata = await sharp(path).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(240);
    expect(metadata.height).toBe(320);
  });

  it("never enlarges an original smaller than the requested width", async () => {
    await writeArtFile(key, {
      body: await poster(100, 150),
      contentType: "image/jpeg",
    });
    const metadata = await sharp(
      await ensureArtVariantCached(key, 480),
    ).metadata();
    expect(metadata.width).toBe(100);
  });

  it("reuses the file on a second call", async () => {
    const path = await ensureArtVariantCached(key, 240);
    const firstWrite = (await fs.stat(path)).mtimeMs;
    expect(await ensureArtVariantCached(key, 240)).toBe(path);
    expect((await fs.stat(path)).mtimeMs).toBe(firstWrite);
  });

  it("generates concurrent requests for the same variant once", async () => {
    const [first, second] = await Promise.all([
      ensureArtVariantCached(key, 480),
      ensureArtVariantCached(key, 480),
    ]);
    expect(first).toBe(second);
    expect(existsSync(first)).toBe(true);
  });

  it("drops variants when the original is refetched", async () => {
    for (const width of ART_VARIANT_WIDTHS) {
      await ensureArtVariantCached(key, width);
    }
    await cacheOriginal();
    for (const width of ART_VARIANT_WIDTHS) {
      expect(existsSync(artVariantFilePath(key, width))).toBe(false);
    }
  });

  it("never lets a variant win the original's extension probe", async () => {
    await ensureArtVariantCached(key, 240);
    await fs.rm(artFilePath(key, "jpg"));
    expect(await findCachedArtFile(key)).toBeNull();
  });
});
