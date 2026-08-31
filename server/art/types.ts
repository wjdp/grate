export const ART_PROVIDERS = ["steam", "gog", "epic"] as const;
export type ArtProvider = (typeof ART_PROVIDERS)[number];

// Steam type names are load bearing: every cached `/art/steam/<appId>/<type>`
// URL and every file already on disk uses them.
export const STEAM_ART_TYPES = [
  "logo",
  "header",
  "hero",
  "posterSmall",
  "poster",
  "background",
  "backgroundV6B",
  "icon",
] as const;
export type SteamArtType = (typeof STEAM_ART_TYPES)[number];

export const GOG_ART_TYPES = [
  "icon",
  "poster",
  "hero",
  "background",
  "logo",
] as const;
export type GogArtType = (typeof GOG_ART_TYPES)[number];

export const EPIC_ART_TYPES = [
  "icon",
  "poster",
  "hero",
  "background",
  "logo",
] as const;
export type EpicArtType = (typeof EPIC_ART_TYPES)[number];

export const ART_TYPES_BY_PROVIDER = {
  steam: STEAM_ART_TYPES,
  gog: GOG_ART_TYPES,
  epic: EPIC_ART_TYPES,
} as const satisfies Record<ArtProvider, readonly string[]>;

export type ArtType = SteamArtType | GogArtType | EpicArtType;

export interface ArtKey {
  provider: ArtProvider;
  id: number;
  type: ArtType;
}
