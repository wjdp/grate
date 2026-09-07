// Edition vocabulary stripped from anywhere in the name, longest phrases first
// so "goty edition" is matched whole rather than leaving a stray "edition".
const EDITION_PHRASES = [
  "game of the year edition",
  "goty edition",
  "goty",
  "definitive edition",
  "complete edition",
  "enhanced edition",
  "extended edition",
  "premium edition",
  "legendary edition",
  "anniversary edition",
  "collector's edition",
  "ultimate edition",
  "deluxe edition",
  "gold edition",
  "legacy edition",
  "standard edition",
  "remastered",
  "redux",
  "the director's cut",
  "director's cut",
  "the final cut",
  "re elected",
];

const TRAILING_TEST_BUILD_PHRASES = [
  "public test server",
  "public test client",
  "public testing",
  "public test",
  "test server",
  "test client",
  "staging branch",
  "beta demo",
  "tech beta",
  "tech test",
  "open beta",
  "closed beta",
  "network test",
  "friend's pass",
  "playtest",
  "demo",
];

// Words marking packaging, a store extra or a non-retail build rather than a
// different game. "vr", "plus", "infinite", "original" and "source" are
// deliberately absent: they mark distinct products.
const PACKAGING_WORDS = new Set([
  "edition",
  "editions",
  "goty",
  "remaster",
  "remastered",
  "redux",
  "deluxe",
  "ultra",
  "ultimate",
  "definitive",
  "complete",
  "enhanced",
  "extended",
  "premium",
  "legendary",
  "anniversary",
  "celebration",
  "collector's",
  "collectors",
  "special",
  "standard",
  "legacy",
  "classic",
  "classics",
  "gold",
  "demo",
  "playtest",
  "beta",
  "alpha",
  "test",
  "testing",
  "branch",
  "staging",
  "server",
  "client",
  "public",
  "tech",
  "network",
  "preview",
  "build",
  "friend's",
  "pass",
  "rtx",
  "soundtrack",
  "soundtracks",
  "ost",
  "bundle",
  "dlc",
  "content",
  "expansion",
  "expansions",
  "upgrade",
  "pack",
  "season",
  "peek",
  "prologue",
  "artbook",
  "wallpapers",
  "cosmetics",
  "hd",
]);

const GLUE_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "of",
  "with",
  "plus",
  "featuring",
  "feat",
  "for",
  "final",
  "cut",
  "director's",
  "digital",
  "goods",
  "sneak",
  "year",
  "new",
  "in",
  "your",
]);

const editionPattern = new RegExp(
  `\\b(?:${EDITION_PHRASES.join("|")})\\b`,
  "g",
);
const trailingTestBuildPattern = new RegExp(
  `\\s(?:${TRAILING_TEST_BUILD_PHRASES.join("|")})$`,
);
const trailingEnhancedPattern = /\benhanced$/;

const trailingParenthetical = /\s*\(([^()]*)\)\s*$/;
const trailingDashSegment = /\s+[-–—]\s+([^-–—]+)$/;
const trailingColonSegment = /:\s+([^:]+)$/;
const trailingSegmentPatterns = [
  trailingParenthetical,
  trailingDashSegment,
  trailingColonSegment,
];

const anniversaryPattern = /^(?:\d+\s+year\s+)?(?:celebration|anniversary)$/;
const trademarkGlyphs = /[™®©]/g;
const digitsOnly = /^\d+$/;

const MAX_PACKAGING_SEGMENT_WORDS = 6;

function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(trademarkGlyphs, "")
    .replace(/[^a-z0-9']+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function isPackagingSegment(segment: string): boolean {
  const segmentWords = wordsOf(segment);
  if (
    segmentWords.length === 0 ||
    segmentWords.length > MAX_PACKAGING_SEGMENT_WORDS
  ) {
    return false;
  }
  if (anniversaryPattern.test(segmentWords.join(" "))) {
    return true;
  }
  const meaningful = segmentWords.filter((word) => !digitsOnly.test(word));
  return (
    meaningful.length > 0 &&
    meaningful.some((word) => PACKAGING_WORDS.has(word)) &&
    meaningful.every(
      (word) => PACKAGING_WORDS.has(word) || GLUE_WORDS.has(word),
    )
  );
}

function stripPackagingSegments(name: string): string {
  let current = name.replace(trademarkGlyphs, "").trim();
  for (;;) {
    const match = trailingSegmentPatterns
      .map((pattern) => current.match(pattern))
      .find((candidate) => candidate && isPackagingSegment(candidate[1]));
    if (!match || match.index === undefined || match.index === 0) {
      return current;
    }
    current = current.slice(0, match.index).trim();
  }
}

function stripTrailingTestBuilds(key: string): string {
  let current = key;
  for (;;) {
    const shorter = current.replace(trailingTestBuildPattern, "").trim();
    if (shorter === current) {
      return current;
    }
    current = shorter;
  }
}

export function normaliseGameName(name: string): string {
  const withoutEditions = stripPackagingSegments(name)
    .toLowerCase()
    .replace(trademarkGlyphs, "")
    .replace(/[^a-z0-9()']/g, " ")
    .replace(editionPattern, "")
    .replace(/\s+/g, " ")
    .trim();

  return stripTrailingTestBuilds(withoutEditions)
    .replace(trailingEnhancedPattern, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface NamedKey {
  name: string;
  key: string;
}

const sequelMarker = /^(?:\d+|[ivxlcdm]+|[a-z])$/;
const firstSeparator = /\s+[-–—]\s+|:\s+|\s+\(/;

const MAX_PACKAGING_SUFFIX_WORDS = 5;
const MIN_SUBTITLE_WORDS = 4;

function baseTitleKey(name: string): string {
  const [head] = name.replace(trademarkGlyphs, "").split(firstSeparator);
  return normaliseGameName(head ?? name);
}

function isPackagingSuffix(suffix: string[]): boolean {
  const meaningful = suffix.filter((word) => !digitsOnly.test(word));
  return (
    meaningful.length > 0 &&
    meaningful.length <= MAX_PACKAGING_SUFFIX_WORDS &&
    (meaningful.at(-1) === "edition" ||
      meaningful.some((word) => PACKAGING_WORDS.has(word)))
  );
}

// "Fallout" vs "Fallout: A Post Nuclear Role Playing Game" — one game listed
// with and without its long descriptive subtitle. A suffix carrying a digit or
// opening on a sequel marker is a different game, not a subtitle.
function isDescriptiveSubtitle(
  shorter: NamedKey,
  longer: NamedKey,
  suffix: string[],
): boolean {
  if (baseTitleKey(longer.name) !== shorter.key) {
    return false;
  }
  if (suffix.some((word) => /\d/.test(word))) {
    return false;
  }
  if (suffix[0].length > 1 && sequelMarker.test(suffix[0])) {
    return false;
  }
  return suffix.length >= MIN_SUBTITLE_WORDS;
}

export function isPackagingVariant(a: NamedKey, b: NamedKey): boolean {
  const [shorter, longer] = a.key.length <= b.key.length ? [a, b] : [b, a];
  if (
    shorter.key === "" ||
    shorter.key === longer.key ||
    !longer.key.startsWith(`${shorter.key} `)
  ) {
    return false;
  }
  const suffix = longer.key.slice(shorter.key.length + 1).split(" ");
  if (sequelMarker.test(suffix[0])) {
    return isDescriptiveSubtitle(shorter, longer, suffix);
  }
  return (
    isPackagingSuffix(suffix) || isDescriptiveSubtitle(shorter, longer, suffix)
  );
}
