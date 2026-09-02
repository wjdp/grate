import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import createFetchMock from "vitest-fetch-mock";

const dataDir = mkdtempSync(join(tmpdir(), "grate-art-"));
vi.stubEnv("DATA_DIR", dataDir);

const { ArtFetchError, ArtSourceNotFoundError, fetchImage, writeArtFile } =
  await import("./fetch");
const { artFilePath, findCachedArtFile } = await import("./paths");

const fetchMocker = createFetchMock(vi);
fetchMocker.enableMocks();

const key = { provider: "gog", id: 1, type: "poster" } as const;
const IMAGE_URL = "https://images.gog-statics.com/abc.png";

function imageResponse(contentType: string, body = "bytes") {
  return { body, headers: { "content-type": contentType } };
}

describe("fetchImage", () => {
  beforeEach(() => {
    fetchMocker.resetMocks();
  });
  afterAll(() => {
    fetchMocker.disableMocks();
  });

  it("returns the body and content type for an image response", async () => {
    fetchMocker.mockResponseOnce(imageResponse("image/png"));
    const image = await fetchImage(IMAGE_URL);
    expect(image.contentType).toBe("image/png");
    expect(image.body.toString()).toBe("bytes");
  });

  it("throws ArtSourceNotFoundError when the CDN 404s", async () => {
    fetchMocker.mockResponseOnce("not found", { status: 404 });
    await expect(fetchImage(IMAGE_URL)).rejects.toBeInstanceOf(
      ArtSourceNotFoundError,
    );
  });

  it("throws ArtFetchError for a server error", async () => {
    fetchMocker.mockResponseOnce("boom", { status: 500 });
    await expect(fetchImage(IMAGE_URL)).rejects.toBeInstanceOf(ArtFetchError);
  });

  it("throws ArtFetchError when the response is not an image", async () => {
    fetchMocker.mockResponseOnce(
      imageResponse("text/html", "<html>404</html>"),
    );
    await expect(fetchImage(IMAGE_URL)).rejects.toBeInstanceOf(ArtFetchError);
  });

  it("throws ArtFetchError when the request fails", async () => {
    fetchMocker.mockRejectOnce(new Error("offline"));
    await expect(fetchImage(IMAGE_URL)).rejects.toBeInstanceOf(ArtFetchError);
  });
});

describe("writeArtFile", () => {
  it("names the file from the content type", async () => {
    const path = await writeArtFile(key, {
      body: Buffer.from("png bytes"),
      contentType: "image/png",
    });
    expect(path).toBe(artFilePath(key, "png"));
    expect(readFileSync(path).toString()).toBe("png bytes");
    expect(await findCachedArtFile(key)).toBe(path);
  });

  it("replaces a cached file written under another extension", async () => {
    const jpgPath = artFilePath(key, "jpg");
    writeFileSync(jpgPath, "old bytes");
    const path = await writeArtFile(key, {
      body: Buffer.from("webp bytes"),
      contentType: "image/webp",
    });
    expect(path).toBe(artFilePath(key, "webp"));
    expect(await findCachedArtFile(key)).toBe(path);
  });
});
