// Edition vocabulary stripped from anywhere in the name, longest phrases first
// so "goty edition" is matched whole rather than leaving a stray "edition".
const EDITION_PHRASES = [
  "game of the year edition",
  "goty edition",
  "goty",
  "definitive edition",
  "complete edition",
  "enhanced edition",
  "remastered",
  "redux",
  "director's cut",
];

const editionPattern = new RegExp(
  `\\b(?:${EDITION_PHRASES.join("|")})\\b`,
  "g",
);

const trailingEnhancedPattern = /\benhanced$/;

export function normaliseGameName(name: string): string {
  const lowered = name.toLowerCase().replace(/[™®©]/g, "");
  const alphanumeric = lowered.replace(/[^a-z0-9()']/g, " ");
  const withoutEditions = alphanumeric.replace(editionPattern, "");
  const withoutTrailingEnhanced = withoutEditions
    .trim()
    .replace(trailingEnhancedPattern, "");

  return withoutTrailingEnhanced.replace(/\s+/g, " ").trim();
}
