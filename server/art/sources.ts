import { eq } from "drizzle-orm";
import { resolveGogImageUrl } from "#shared/art";
import {
  epicGame,
  gogGame,
  steamAppInfo,
  steamGame,
  steamPicsMetadata,
} from "~~/db/schema";
import { db } from "~~/lib/db";
import { getSteamArtUrls } from "~~/lib/steam/art";
import type { ArtKey, EpicArtType, GogArtType, SteamArtType } from "./types";

const GOG_ICON_FORMATTER = "glx_square_icon_v2";
const GOG_LOGO_FORMATTER = "glx_logo_2x";

// Many Steam apps have no library art at either size; the header capsule is a
// poor but non-empty poster, so it ends the chain.
const STEAM_POSTER_FALLBACKS = ["poster", "posterSmall", "header"] as const;

const STEAM_PICS_ASSETS_BASE_URL =
  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";

// PICS asset paths are opaque and content-hashed — append verbatim, never
// construct them.
function picsAssetUrl(appId: number, path: string | null): string | null {
  return path ? `${STEAM_PICS_ASSETS_BASE_URL}/${appId}/${path}` : null;
}

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

// Ordered candidate list from several possibly-null URLs, deduplicated and
// with nulls dropped.
function orderedCandidates(
  urls: Array<string | null | undefined>,
): ArtSource[] {
  const seen = new Set<string>();
  const candidates: ArtSource[] = [];
  for (const url of urls) {
    if (url && !seen.has(url)) {
      seen.add(url);
      candidates.push({ url });
    }
  }
  return candidates;
}

async function resolveSteamArtSources(
  appId: number,
  type: SteamArtType,
): Promise<ArtSource[]> {
  const legacyUrls = getSteamArtUrls(appId);

  if (type === "background" || type === "backgroundV6B") {
    return sourceCandidates(legacyUrls[type]);
  }

  if (type === "icon") {
    const row = db
      .select()
      .from(steamGame)
      .where(eq(steamGame.appId, appId))
      .get();
    const picsRow = db
      .select()
      .from(steamPicsMetadata)
      .where(eq(steamPicsMetadata.appId, appId))
      .get();
    const primary = row?.imgIconUrl
      ? `http://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${row.imgIconUrl}.jpg`
      : null;
    const fallback = picsRow?.iconHash
      ? `http://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${picsRow.iconHash}.jpg`
      : null;
    return orderedCandidates([primary, fallback]);
  }

  const picsRow = db
    .select()
    .from(steamPicsMetadata)
    .where(eq(steamPicsMetadata.appId, appId))
    .get();

  switch (type) {
    case "poster":
      return orderedCandidates([
        picsAssetUrl(appId, picsRow?.capsule2xPath ?? null),
        picsAssetUrl(appId, picsRow?.capsulePath ?? null),
        ...STEAM_POSTER_FALLBACKS.map((fallback) => legacyUrls[fallback]),
      ]);
    case "posterSmall":
      return orderedCandidates([
        picsAssetUrl(appId, picsRow?.capsulePath ?? null),
        legacyUrls.posterSmall,
      ]);
    case "hero":
      return orderedCandidates([
        picsAssetUrl(appId, picsRow?.hero2xPath ?? null),
        picsAssetUrl(appId, picsRow?.heroPath ?? null),
        legacyUrls.hero,
      ]);
    case "logo":
      return orderedCandidates([
        picsAssetUrl(appId, picsRow?.logo2xPath ?? null),
        picsAssetUrl(appId, picsRow?.logoPath ?? null),
        legacyUrls.logo,
      ]);
    case "header":
      return orderedCandidates([
        picsAssetUrl(appId, picsRow?.headerPath ?? null),
        legacyUrls.header,
      ]);
    case "backdrop": {
      const appInfoRow = db
        .select({ backgroundRaw: steamAppInfo.backgroundRaw })
        .from(steamAppInfo)
        .where(eq(steamAppInfo.appId, appId))
        .get();
      return orderedCandidates([
        picsAssetUrl(appId, picsRow?.heroPath ?? null),
        legacyUrls.hero,
        present(appInfoRow?.backgroundRaw),
        legacyUrls.background,
        legacyUrls.backgroundV6B,
      ]);
    }
  }
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
