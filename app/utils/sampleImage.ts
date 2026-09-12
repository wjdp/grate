// Draws an image into a small offscreen canvas so its pixels can be measured.
// Returns null when the image cannot be sampled (cross-origin taint, no 2d
// context, decode error).
export function sampleImagePixels(
  image: HTMLImageElement,
  width: number,
  height: number,
): Uint8ClampedArray | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  try {
    context.drawImage(image, 0, 0, width, height);
    return context.getImageData(0, 0, width, height).data;
  } catch {
    return null;
  }
}
