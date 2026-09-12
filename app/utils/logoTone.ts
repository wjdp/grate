import { sampleImagePixels } from "~/utils/sampleImage";

// Store logos are wordmarks on transparency, often with margins far larger
// than the mark itself, so transparent pixels are ignored when judging tone.
export const LOGO_OPAQUE_ALPHA = 128;

// Mini Metro's wordmark, the motivating case, measures around 36.
export const LOGO_DARK_LUMINANCE = 100;

const SAMPLE_WIDTH = 48;
const SAMPLE_HEIGHT = 24;

// Returns null when no pixel is opaque enough to judge.
export function opaqueMeanLuminance(pixels: Uint8ClampedArray): number | null {
  let total = 0;
  let count = 0;
  for (let offset = 0; offset + 3 < pixels.length; offset += 4) {
    if ((pixels[offset + 3] ?? 0) <= LOGO_OPAQUE_ALPHA) {
      continue;
    }
    const [red, green, blue] = [
      pixels[offset] ?? 0,
      pixels[offset + 1] ?? 0,
      pixels[offset + 2] ?? 0,
    ];
    total += 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    count += 1;
  }
  return count === 0 ? null : total / count;
}

export function isDarkLogo(luminance: number | null): boolean {
  return luminance !== null && luminance < LOGO_DARK_LUMINANCE;
}

// Returns null when the image cannot be sampled (cross-origin, decode error).
export function measureLogoLuminance(image: HTMLImageElement): number | null {
  const pixels = sampleImagePixels(image, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  return pixels === null ? null : opaqueMeanLuminance(pixels);
}
