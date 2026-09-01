import type { GameWithProviders } from "./types/Game";

export interface ArtUrls {
  icon: string | null;
  poster: string | null;
  hero: string | null;
  background: string | null;
  logo: string | null;
}

const ART_URL_BASE_PATH = "/art";

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

export function getPrimarySteamGame(game: GameWithProviders) {
  return game.steamGames[0] ?? null;
}

export function getPrimaryGogGame(game: GameWithProviders) {
  return game.gogGames[0] ?? null;
}

export function getPrimaryEpicGame(game: GameWithProviders) {
  return game.epicGames[0] ?? null;
}

// The art route serves `/art/<provider>/<id>/<type>` and fetches on miss, so a
// URL is emitted whenever the client can see a source exists. Steam art is
// derived by convention from the app id, so every Steam type gets a URL; GOG
// and Epic art is only cacheable when the backing column holds a URL.
function artUrl(
  provider: "steam" | "gog" | "epic",
  id: number,
  type: string,
): string {
  return `${ART_URL_BASE_PATH}/${provider}/${id}/${type}`;
}

function artUrlWhenPresent(
  provider: "gog" | "epic",
  id: number,
  type: string,
  ...sources: (string | null | undefined)[]
): string | null {
  return sources.some((source) => Boolean(source))
    ? artUrl(provider, id, type)
    : null;
}

export function getGameArtUrls(game: GameWithProviders): ArtUrls | null {
  const steamGame = getPrimarySteamGame(game);
  if (steamGame) {
    const { appId } = steamGame;
    return {
      icon: artUrl("steam", appId, "icon"),
      poster: artUrl("steam", appId, "poster"),
      hero: artUrl("steam", appId, "hero"),
      background: artUrl("steam", appId, "backdrop"),
      logo: artUrl("steam", appId, "logo"),
    };
  }
  const gogGame = getPrimaryGogGame(game);
  if (gogGame) {
    const { gogId } = gogGame;
    return {
      icon: artUrlWhenPresent(
        "gog",
        gogId,
        "icon",
        gogGame.iconSquareUrl,
        gogGame.iconUrl,
      ),
      poster: artUrlWhenPresent("gog", gogId, "poster", gogGame.boxArtImageUrl),
      hero: artUrlWhenPresent("gog", gogId, "hero", gogGame.backgroundImageUrl),
      background: artUrlWhenPresent(
        "gog",
        gogId,
        "background",
        gogGame.galaxyBackgroundImageUrl,
        gogGame.backgroundImageUrl,
      ),
      logo: artUrlWhenPresent("gog", gogId, "logo", gogGame.logoUrl),
    };
  }
  const epicGame = getPrimaryEpicGame(game);
  if (epicGame) {
    const { epicId } = epicGame;
    return {
      icon: artUrlWhenPresent("epic", epicId, "icon", epicGame.boxArtTallUrl),
      poster: artUrlWhenPresent(
        "epic",
        epicId,
        "poster",
        epicGame.boxArtTallUrl,
      ),
      hero: artUrlWhenPresent("epic", epicId, "hero", epicGame.boxArtWideUrl),
      background: artUrlWhenPresent(
        "epic",
        epicId,
        "background",
        epicGame.boxArtWideUrl,
      ),
      logo: artUrlWhenPresent("epic", epicId, "logo", epicGame.logoUrl),
    };
  }
  return null;
}
