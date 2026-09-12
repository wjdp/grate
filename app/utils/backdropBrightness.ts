// Backdrops are dimmed so the hero text reads over them, but many store
// backgrounds (Steam's generated page backgrounds especially) are already
// dark and tinted. Dimming those by the full amount leaves them invisible, so
// the dimming eases off as the measured luminance falls.
export const BACKDROP_TARGET_LUMINANCE = 48;
export const BACKDROP_MIN_BRIGHTNESS = 0.5;
export const BACKDROP_MAX_BRIGHTNESS = 1;

const SAMPLE_WIDTH = 32;
const SAMPLE_HEIGHT = 18;

export function backdropBrightness(meanLuminance: number): number {
  if (meanLuminance <= 0) {
    return BACKDROP_MAX_BRIGHTNESS;
  }
  return Math.min(
    BACKDROP_MAX_BRIGHTNESS,
    Math.max(
      BACKDROP_MIN_BRIGHTNESS,
      BACKDROP_TARGET_LUMINANCE / meanLuminance,
    ),
  );
}

export function meanLuminance(pixels: Uint8ClampedArray): number {
  let total = 0;
  const count = pixels.length / 4;
  for (let offset = 0; offset + 2 < pixels.length; offset += 4) {
    const [red, green, blue] = [
      pixels[offset] ?? 0,
      pixels[offset + 1] ?? 0,
      pixels[offset + 2] ?? 0,
    ];
    total += 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }
  return count === 0 ? 0 : total / count;
}

// Returns null when the image cannot be sampled (cross-origin, decode error).
export function measureImageLuminance(image: HTMLImageElement): number | null {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_WIDTH;
  canvas.height = SAMPLE_HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  try {
    context.drawImage(image, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
    return meanLuminance(
      context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data,
    );
  } catch {
    return null;
  }
}
