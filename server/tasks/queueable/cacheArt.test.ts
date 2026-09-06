import { existsSync, mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "~~/server/tasks/queue";

const dataDir = mkdtempSync(join(tmpdir(), "grate-cache-art-"));
vi.stubEnv("DATA_DIR", dataDir);

vi.mock("~~/server/tasks/queue", () => ({
  createTask: vi.fn(),
  updateInProgressTask: vi.fn(),
}));

const { flushDb } = await import("~~/test/db");
const { createGogGame } = await import("~~/test/fixtures/game");
const { artVariantFilePath } = await import("~~/server/services/art/paths");
const cacheArt = (await import("./cacheArt")).default;
const { ART_VARIANT_WIDTHS } = await import("~~/server/services/art");

const POSTER_URL = "https://images.gog-statics.com/poster.jpg";
const HERO_URL = "https://images.gog-statics.com/hero.jpg";

const task: Task = { id: 1, name: "cacheArt", state: "in_progress" };

function poster(width = 600, height = 800) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 9, g: 9, b: 9 } },
  })
    .jpeg()
    .toBuffer();
}

function stubFetch(bodyForUrl: (url: string) => Promise<Buffer> | Buffer) {
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = input.toString();
    return new Response(new Uint8Array(await bodyForUrl(url)), {
      headers: { "content-type": "image/jpeg" },
    });
  });
}

function variantPaths(gogId: number, type: "poster" | "hero") {
  return ART_VARIANT_WIDTHS.map((width) =>
    artVariantFilePath({ provider: "gog", id: gogId, type }, width),
  );
}

describe("cacheArt", () => {
  beforeEach(async () => {
    flushDb();
    await fs.rm(dataDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("writes both poster variants alongside the cached original", async () => {
    const { gogId } = createGogGame({ boxArtImageUrl: POSTER_URL });
    stubFetch(() => poster());

    await cacheArt(task);

    for (const path of variantPaths(gogId, "poster")) {
      expect(existsSync(path)).toBe(true);
    }
    expect(await sharp(variantPaths(gogId, "poster")[0]).metadata()).toEqual(
      expect.objectContaining({ format: "webp", width: 240 }),
    );
  });

  it("leaves non-poster art without variants", async () => {
    const { gogId } = createGogGame({
      boxArtImageUrl: POSTER_URL,
      backgroundImageUrl: HERO_URL,
    });
    stubFetch(() => poster());

    await cacheArt(task);

    for (const path of variantPaths(gogId, "hero")) {
      expect(existsSync(path)).toBe(false);
    }
  });

  it("logs and continues when a variant cannot be generated", async () => {
    createGogGame({ boxArtImageUrl: POSTER_URL });
    stubFetch(() => Buffer.from("not an image"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(cacheArt(task)).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining("Could not generate gog poster variants"),
    );
  });
});
