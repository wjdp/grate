import type { GameDetail } from "../types/Game";

export type Provider = "steam" | "gog" | "epic";

export const PROVIDERS: readonly Provider[] = ["steam", "gog", "epic"];

export type ProviderFilter = "all" | Provider;

export const ProviderLabels: Record<Provider, string> = {
  steam: "Steam",
  gog: "GOG",
  epic: "Epic Games",
};

export interface ProviderRowLinks {
  openUrl: string;
  playUrl: string;
}

type SteamRow = Pick<GameDetail["steamGames"][number], "appId">;
type GogRow = Pick<GameDetail["gogGames"][number], "gogId">;
type EpicRow = Pick<
  GameDetail["epicGames"][number],
  "namespace" | "catalogItemId" | "appName" | "storeSlug"
>;

export function getSteamRowLinks(row: SteamRow): ProviderRowLinks {
  return {
    openUrl: `steam://nav/games/details/${row.appId}`,
    playUrl: `steam://run/${row.appId}`,
  };
}

export function getGogRowLinks(row: GogRow): ProviderRowLinks {
  return {
    openUrl: `goggalaxy://openGameView/${row.gogId}`,
    playUrl: `goggalaxy://runGame/${row.gogId}`,
  };
}

export function getEpicRowLinks(row: EpicRow): ProviderRowLinks {
  const assetId = encodeURIComponent(
    `${row.namespace}:${row.catalogItemId}:${row.appName}`,
  );
  const playUrl = `com.epicgames.launcher://apps/${assetId}?action=launch&silent=true`;
  return {
    openUrl: row.storeSlug
      ? `https://store.epicgames.com/p/${row.storeSlug}`
      : playUrl,
    playUrl,
  };
}

export interface PrimaryLaunch extends ProviderRowLinks {
  playtimeMinutes: number;
}

interface PrimaryLaunchGame {
  steamGames: (SteamRow & { playtimeForever?: number | null })[];
  gogGames: (GogRow & { playtimeMinutes?: number | null })[];
  epicGames: (EpicRow & { playtimeMinutes?: number | null })[];
}

export function getPrimaryLaunch(
  game: PrimaryLaunchGame,
): PrimaryLaunch | null {
  const targets: PrimaryLaunch[] = [
    ...game.steamGames.map((row) => ({
      playtimeMinutes: row.playtimeForever ?? 0,
      ...getSteamRowLinks(row),
    })),
    ...game.gogGames.map((row) => ({
      playtimeMinutes: row.playtimeMinutes ?? 0,
      ...getGogRowLinks(row),
    })),
    ...game.epicGames.map((row) => ({
      playtimeMinutes: row.playtimeMinutes ?? 0,
      ...getEpicRowLinks(row),
    })),
  ];
  return targets.reduce<PrimaryLaunch | null>(
    (best, target) =>
      !best || target.playtimeMinutes > best.playtimeMinutes ? target : best,
    null,
  );
}
