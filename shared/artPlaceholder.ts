export interface PlaceholderColour {
  h: number;
  s: number;
  l: number;
}

// Muted and dark enough that any hue sits with the app's palette rather than
// competing with the amber chrome.
const PLACEHOLDER_SATURATION = 34;
const PLACEHOLDER_LIGHTNESS = 30;

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

function hashName(name: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

export function getPlaceholderColour(name: string): PlaceholderColour {
  return {
    h: hashName(name) % 360,
    s: PLACEHOLDER_SATURATION,
    l: PLACEHOLDER_LIGHTNESS,
  };
}

export function formatHsl({ h, s, l }: PlaceholderColour): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function getPlaceholderColourCss(name: string): string {
  return formatHsl(getPlaceholderColour(name));
}
