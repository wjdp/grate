import sharp from "sharp";
import type { FetchedImage } from "./fetch";

export const EPIC_ICON_SIZE = 128;

// Epic ships no icon asset, so the tall box art is cropped to a square at
// cache-fill time.
export async function deriveEpicIcon(
  image: FetchedImage,
): Promise<FetchedImage> {
  const body = await sharp(image.body)
    .resize(EPIC_ICON_SIZE, EPIC_ICON_SIZE, {
      fit: "cover",
      position: "centre",
    })
    .webp()
    .toBuffer();
  return { body, contentType: "image/webp" };
}
