import type { GameWithProviders } from "./types/Game";

export interface ArtUrls {
  header: string | null;
  poster: string | null;
  posterSmall: string | null;
  background: string | null;
}

const ART_URL_BASE_PATH = "/art/steam";

// GOG's v2 API returns templated image hrefs, e.g.
// https://images.gog.com/<hash>_{formatter}.{ext} — the caller picks a named
// formatter (a GOG-side resize preset) and an extension. Anything left
// unsubstituted 404s, so every GOG URL goes through this.
const GOG_EXTENSION = "png";

export function resolveGogImageUrl(
  url: string | null | undefined,
  formatter: string,
): string | null {
  if (!url) {
    return null;
  }
  return url
    .replace("{formatter}", formatter)
    .replace("{ext}", GOG_EXTENSION)
    .replace(/\.{ext}$/, `.${GOG_EXTENSION}`);
}

const GOG_LOGO_FORMATTER = "glx_logo_2x";
const GOG_BOX_ART_FORMATTER = "product_card_v2_mobile_slider_639";
const GOG_BACKGROUND_FORMATTER = "glx_bg_top_padding_7";
const GOG_ICON_FORMATTER = "glx_icon_square";

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
    const boxArt = resolveGogImageUrl(
      gogGame.boxArtImageUrl,
      GOG_BOX_ART_FORMATTER,
    );
    const background =
      resolveGogImageUrl(
        gogGame.galaxyBackgroundImageUrl,
        GOG_BACKGROUND_FORMATTER,
      ) ??
      resolveGogImageUrl(gogGame.backgroundImageUrl, GOG_BACKGROUND_FORMATTER);
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
