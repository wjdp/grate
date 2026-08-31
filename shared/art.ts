import type { GameWithProviders } from "./types/Game";

export interface ArtUrls {
  header: string | null;
  poster: string | null;
  posterSmall: string | null;
  background: string | null;
}

const ART_URL_BASE_PATH = "/art/steam";

// GOG image hrefs come in two shapes. The v2 API documents a templated href
// (https://images.gog.com/<hash>_{formatter}.{ext}) where the caller picks a
// named formatter (a GOG-side resize preset) and an extension. In practice
// every stored href is a plain hash URL
// (https://images.gog-statics.com/<hash>.png), and the CDN applies a preset
// when the formatter is appended before the extension.
const GOG_TEMPLATED_EXTENSION = "png";
const GOG_TEMPLATE_MARKER = "{formatter}";
const GOG_HASH_URL_PATTERN = /^(.*)\.([A-Za-z0-9]+)$/;

export function resolveGogImageUrl(
  url: string | null | undefined,
  formatter: string,
): string | null {
  if (!url) {
    return null;
  }
  if (url.includes(GOG_TEMPLATE_MARKER)) {
    return url
      .replace(GOG_TEMPLATE_MARKER, formatter)
      .replace("{ext}", GOG_TEMPLATED_EXTENSION)
      .replace(/\.{ext}$/, `.${GOG_TEMPLATED_EXTENSION}`);
  }
  const hashUrl = GOG_HASH_URL_PATTERN.exec(url);
  if (!hashUrl) {
    return url;
  }
  const [, base, extension] = hashUrl;
  return `${base}_${formatter}.${extension}`;
}

export function resolveEpicImageUrl(
  url: string | null | undefined,
  { w, h }: { w?: number; h?: number },
): string | null {
  if (!url) {
    return null;
  }
  if (w === undefined && h === undefined) {
    return url;
  }
  const resized = new URL(url);
  if (w !== undefined) {
    resized.searchParams.set("w", String(w));
  }
  if (h !== undefined) {
    resized.searchParams.set("h", String(h));
  }
  resized.searchParams.set("resize", "1");
  return resized.toString();
}

const GOG_LOGO_FORMATTER = "glx_logo_2x";
const GOG_ICON_FORMATTER = "glx_square_icon_v2";

export function getGogIconUrl(
  gogGame: Pick<
    GameWithProviders["gogGames"][number],
    "iconSquareUrl" | "iconUrl"
  >,
): string | null {
  return (
    resolveGogImageUrl(gogGame.iconSquareUrl, GOG_ICON_FORMATTER) ??
    resolveGogImageUrl(gogGame.iconUrl, GOG_ICON_FORMATTER)
  );
}

export function getPrimarySteamGame(game: GameWithProviders) {
  return game.steamGames[0] ?? null;
}

export function getPrimaryGogGame(game: GameWithProviders) {
  return game.gogGames[0] ?? null;
}

export function getPrimaryEpicGame(game: GameWithProviders) {
  return game.epicGames[0] ?? null;
}

export function getEpicIconUrl(
  epicGame: Pick<GameWithProviders["epicGames"][number], "boxArtTallUrl">,
): string | null {
  return epicGame.boxArtTallUrl ?? null;
}

export function getGameArtUrls(game: GameWithProviders): ArtUrls | null {
  const steamGame = getPrimarySteamGame(game);
  if (steamGame) {
    return {
      header: `${ART_URL_BASE_PATH}/${steamGame.appId}/header`,
      poster: `${ART_URL_BASE_PATH}/${steamGame.appId}/poster`,
      posterSmall: `${ART_URL_BASE_PATH}/${steamGame.appId}/posterSmall`,
      background: `${ART_URL_BASE_PATH}/${steamGame.appId}/backgroundV6B`,
    };
  }
  const gogGame = getPrimaryGogGame(game);
  if (gogGame) {
    const logo = resolveGogImageUrl(gogGame.logoUrl, GOG_LOGO_FORMATTER);
    const boxArt = gogGame.boxArtImageUrl || null;
    const background =
      gogGame.galaxyBackgroundImageUrl || gogGame.backgroundImageUrl || null;
    return {
      header: logo ?? boxArt,
      poster: boxArt,
      posterSmall: boxArt,
      background,
    };
  }
  const epicGame = getPrimaryEpicGame(game);
  if (epicGame) {
    return {
      header: epicGame.logoUrl ?? epicGame.boxArtWideUrl,
      poster: epicGame.boxArtTallUrl,
      posterSmall: epicGame.boxArtTallUrl,
      background: epicGame.boxArtWideUrl,
    };
  }
  return null;
}
