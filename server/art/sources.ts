import { eq } from "drizzle-orm";
import { db } from "~~/lib/db";
import { epicGame, gogGame, steamGame } from "~~/db/schema";
import { getSteamArtUrls } from "~~/lib/steam/art";
import { resolveGogImageUrl } from "#shared/art";
import type { ArtKey, EpicArtType, GogArtType, SteamArtType } from "./types";

const GOG_ICON_FORMATTER = "glx_square_icon_v2";
const GOG_LOGO_FORMATTER = "glx_logo_2x";

export interface ArtSource {
  url: string;
  derive?: "epicIcon";
}

function present(url: string | null | undefined): string | null {
  return url ? url : null;
}

function withSource(url: string | null, derive?: ArtSource["derive"]) {
  return url ? { url, ...(derive ? { derive } : {}) } : null;
}

async function resolveSteamArtSource(
  appId: number,
  type: SteamArtType,
): Promise<ArtSource | null> {
  if (type !== "icon") {
    return withSource(getSteamArtUrls(appId)[type]);
  }
  const row = db
    .select()
    .from(steamGame)
    .where(eq(steamGame.appId, appId))
    .get();
  if (!row || !row.imgIconUrl) {
    return null;
  }
  return withSource(
    `http://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${row.imgIconUrl}.jpg`,
  );
}

async function resolveGogArtSource(
  gogId: number,
  type: GogArtType,
): Promise<ArtSource | null> {
  const row = db.select().from(gogGame).where(eq(gogGame.gogId, gogId)).get();
  if (!row) {
    return null;
  }
  switch (type) {
    case "icon":
      return withSource(
        resolveGogImageUrl(
          present(row.iconSquareUrl) ?? present(row.iconUrl),
          GOG_ICON_FORMATTER,
        ),
      );
    case "logo":
      return withSource(
        resolveGogImageUrl(present(row.logoUrl), GOG_LOGO_FORMATTER),
      );
    case "poster":
      return withSource(present(row.boxArtImageUrl));
    case "hero":
      return withSource(present(row.backgroundImageUrl));
    case "background":
      return withSource(
        present(row.galaxyBackgroundImageUrl) ??
          present(row.backgroundImageUrl),
      );
  }
}

async function resolveEpicArtSource(
  epicId: number,
  type: EpicArtType,
): Promise<ArtSource | null> {
  const row = db
    .select()
    .from(epicGame)
    .where(eq(epicGame.epicId, epicId))
    .get();
  if (!row) {
    return null;
  }
  switch (type) {
    case "icon":
      return withSource(present(row.boxArtTallUrl), "epicIcon");
    case "poster":
      return withSource(present(row.boxArtTallUrl));
    case "hero":
    case "background":
      return withSource(present(row.boxArtWideUrl));
    case "logo":
      return withSource(present(row.logoUrl));
  }
}

export async function resolveArtSource({
  provider,
  id,
  type,
}: ArtKey): Promise<ArtSource | null> {
  switch (provider) {
    case "steam":
      return resolveSteamArtSource(id, type as SteamArtType);
    case "gog":
      return resolveGogArtSource(id, type as GogArtType);
    case "epic":
      return resolveEpicArtSource(id, type as EpicArtType);
  }
}
