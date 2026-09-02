// Path/hash columns are what feeds resolveSteamArtSources; the rest of the
// PICS row (review scores, tags, etc.) isn't art-relevant.
export const STEAM_PICS_ART_COLUMNS = [
  "capsulePath",
  "capsule2xPath",
  "heroPath",
  "hero2xPath",
  "heroBlurPath",
  "logoPath",
  "logo2xPath",
  "headerPath",
  "header2xPath",
  "iconHash",
] as const;

export type SteamPicsArtColumn = (typeof STEAM_PICS_ART_COLUMNS)[number];

export type SteamPicsArtMetadata = { fetchedAt: string } & Record<
  SteamPicsArtColumn,
  string | null
>;
