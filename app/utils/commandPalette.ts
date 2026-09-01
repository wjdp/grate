import { getGameArtUrls } from "#shared/art";
import {
  type GameState,
  GameStateHues,
  GameStateIcons,
  GameStateNames,
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
    { label: "Settings", icon: "i-lucide-settings", to: "/settings" },
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

export type GameActionId = "go-to" | "set-state" | "play" | "open-store";

export interface GameActionCommand {
  id: GameActionId;
  label: string;
  icon: string;
  url?: string;
}

export function buildGameActionCommands(
  game: GameWithProviders,
): GameActionCommand[] {
  const launch = getPrimaryLaunch(game);
  const launchCommands: GameActionCommand[] = launch
    ? [
        {
          id: "play",
          label: "Play",
          icon: "i-lucide-play",
          url: launch.playUrl,
        },
        {
          id: "open-store",
          label: "Open store page",
          icon: "i-lucide-external-link",
          url: launch.openUrl,
        },
      ]
    : [];
  return [
    { id: "go-to", label: "Go to game", icon: "i-lucide-arrow-right" },
    { id: "set-state", label: "Set state…", icon: "i-lucide-tag" },
    ...launchCommands,
  ];
}

export interface StateCommand {
  state: GameState | null;
  label: string;
  icon: string;
  iconClass: string;
}

const toStateCommand = (state: GameState): StateCommand => ({
  state,
  label: GameStateNames[state],
  icon: GameStateIcons[state],
  iconClass: GameStateHues[state].icon,
});

// Grouped as GameStateControl groups them, so both pickers read the same.
export const GAME_STATE_COMMAND_GROUPS: StateCommand[][] = [
  [
    {
      state: null,
      label: "Unsorted",
      icon: "i-lucide-circle-dashed",
      iconClass: "text-grey-500 dark:text-grey-400",
    },
  ],
  [toStateCommand("BACKLOG")],
  [
    toStateCommand("PLAYING"),
    toStateCommand("PERIODIC"),
    toStateCommand("SHELVED"),
  ],
  [
    toStateCommand("PLAYED"),
    toStateCommand("COMPLETED"),
    toStateCommand("RETIRED"),
    toStateCommand("ABANDONED"),
  ],
  [toStateCommand("IGNORED")],
];

export const GAME_STATE_COMMANDS: StateCommand[] =
  GAME_STATE_COMMAND_GROUPS.flat();
