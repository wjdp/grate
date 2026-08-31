import { eq } from "drizzle-orm";
import { db } from "~~/lib/db";
import { epicGame, gogGame, steamGame } from "~~/db/schema";
import { getSteamArtUrls } from "~~/lib/steam/art";
import { resolveGogImageUrl } from "#shared/art";
import type { ArtKey, EpicArtType, GogArtType, SteamArtType } from "./types";

const GOG_ICON_FORMATTER = "glx_square_icon_v2";
const GOG_LOGO_FORMATTER = "glx_logo_2x";

// Many Steam apps have no library art at either size; the header capsule is a
// poor but non-empty poster, so it ends the chain.
const STEAM_POSTER_FALLBACKS = ["poster", "posterSmall", "header"] as const;

export interface ArtSource {
  url: string;
  derive?: "epicIcon";
}

function present(url: string | null | undefined): string | null {
  return url ? url : null;
}

function sourceCandidates(
  url: string | null,
  derive?: ArtSource["derive"],
): ArtSource[] {
  return url ? [{ url, ...(derive ? { derive } : {}) }] : [];
}

async function resolveSteamArtSources(
  appId: number,
  type: SteamArtType,
): Promise<ArtSource[]> {
  if (type === "poster") {
    const urls = getSteamArtUrls(appId);
    return STEAM_POSTER_FALLBACKS.map((fallback) => ({ url: urls[fallback] }));
  }
  if (type !== "icon") {
    return sourceCandidates(getSteamArtUrls(appId)[type]);
  }
  const row = db
    .select()
    .from(steamGame)
    .where(eq(steamGame.appId, appId))
    .get();
  if (!row || !row.imgIconUrl) {
    return [];
  }
  return sourceCandidates(
    `http://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${row.imgIconUrl}.jpg`,
  );
}

async function resolveGogArtSources(
  gogId: number,
  type: GogArtType,
): Promise<ArtSource[]> {
  const row = db.select().from(gogGame).where(eq(gogGame.gogId, gogId)).get();
  if (!row) {
    return [];
  }
  switch (type) {
    case "icon":
      return sourceCandidates(
        resolveGogImageUrl(
          present(row.iconSquareUrl) ?? present(row.iconUrl),
          GOG_ICON_FORMATTER,
        ),
      );
    case "logo":
      return sourceCandidates(
        resolveGogImageUrl(present(row.logoUrl), GOG_LOGO_FORMATTER),
      );
    case "poster":
      return sourceCandidates(present(row.boxArtImageUrl));
    case "hero":
      return sourceCandidates(present(row.backgroundImageUrl));
    case "background":
      return sourceCandidates(
        present(row.galaxyBackgroundImageUrl) ??
          present(row.backgroundImageUrl),
      );
  }
}

async function resolveEpicArtSources(
  epicId: number,
  type: EpicArtType,
): Promise<ArtSource[]> {
  const row = db
    .select()
    .from(epicGame)
    .where(eq(epicGame.epicId, epicId))
    .get();
  if (!row) {
    return [];
  }
  switch (type) {
    case "icon":
      return sourceCandidates(present(row.boxArtTallUrl), "epicIcon");
    case "poster":
      return sourceCandidates(present(row.boxArtTallUrl));
    case "hero":
    case "background":
      return sourceCandidates(present(row.boxArtWideUrl));
    case "logo":
      return sourceCandidates(present(row.logoUrl));
  }
}

// Candidates are tried in order; the first that the CDN serves is cached under
// the requested type.
export async function resolveArtSources({
  provider,
  id,
  type,
}: ArtKey): Promise<ArtSource[]> {
  switch (provider) {
    case "steam":
      return resolveSteamArtSources(id, type as SteamArtType);
    case "gog":
      return resolveGogArtSources(id, type as GogArtType);
    case "epic":
      return resolveEpicArtSources(id, type as EpicArtType);
  }
}
