import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { deriveEpicIcon, EPIC_ICON_SIZE } from "./epicIcon";

async function tallBoxArt() {
  return sharp({
    create: {
      width: 300,
      height: 400,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe("deriveEpicIcon", () => {
  it("crops tall box art to a square webp icon", async () => {
    const icon = await deriveEpicIcon({
      body: await tallBoxArt(),
      contentType: "image/jpeg",
    });
    expect(icon.contentType).toBe("image/webp");
    const metadata = await sharp(icon.body).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(EPIC_ICON_SIZE);
    expect(metadata.height).toBe(EPIC_ICON_SIZE);
  });
});
