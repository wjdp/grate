import type { GameDetail } from "../types/Game";

export type Provider = "steam" | "gog" | "epic";

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
