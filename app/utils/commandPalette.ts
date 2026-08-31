import { getGameArtUrls } from "#shared/art";
import {
  GameStateHues,
  GameStateIcons,
  GameStateNames,
  type GameState,
} from "#shared/game-state";
import { getPrimaryLaunch } from "#shared/providers";
import type { GameWithProviders } from "#shared/types/Game";

export interface NavigationCommand {
  label: string;
  icon: string;
  to: string;
  suffix?: string;
}

// Mirrors AppSidebar's navigation, debug pages last.
export function buildNavigationCommands(
  duplicateCount: number | null,
): NavigationCommand[] {
  return [
    { label: "Library", icon: "i-lucide-library-big", to: "/games" },
    { label: "Organise", icon: "i-lucide-list-checks", to: "/organise" },
    {
      label: "Duplicates",
      icon: "i-lucide-copy",
      to: "/duplicates",
      ...(duplicateCount ? { suffix: String(duplicateCount) } : {}),
    },
    { label: "Activity", icon: "i-lucide-activity", to: "/activity" },
    { label: "Providers", icon: "i-lucide-plug", to: "/providers" },
    { label: "Tasks", icon: "i-lucide-list-todo", to: "/tasks" },
    {
      label: "Components",
      icon: "i-lucide-component",
      to: "/debug/components",
    },
    { label: "Events", icon: "i-lucide-radio", to: "/debug/sse" },
    { label: "Steam art", icon: "i-lucide-image", to: "/debug/steam-art" },
  ];
}

export function resolveRecentGames(
  games: GameWithProviders[],
  recentGameIds: number[],
): GameWithProviders[] {
  const gamesById = new Map(games.map((game) => [game.id, game]));
  return recentGameIds
    .map((id) => gamesById.get(id))
    .filter((game): game is GameWithProviders => game !== undefined);
}

export function getGameIconUrl(game: GameWithProviders): string | null {
  return getGameArtUrls(game)?.icon ?? null;
}
