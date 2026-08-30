export const GAME_STATES = [
  "BACKLOG",
  "PLAYING",
  "PERIODIC",
  "SHELVED",
  "PLAYED",
  "COMPLETED",
  "RETIRED",
  "ABANDONED",
] as const;

export type GameState = (typeof GAME_STATES)[number];

export const GameStateNames: Record<GameState, string> = {
  BACKLOG: "Backlog",
  PLAYING: "Playing",
  PERIODIC: "Periodic",
  SHELVED: "Shelved",
  PLAYED: "Played",
  COMPLETED: "Completed",
  RETIRED: "Retired",
  ABANDONED: "Abandoned",
} as const;

export interface GameStateHue {
  badge: string;
  dot: string;
}

export const GameStateHues: Record<GameState, GameStateHue> = {
  BACKLOG: {
    badge: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  PLAYING: {
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  PERIODIC: {
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  SHELVED: {
    badge: "bg-grey-500/15 text-grey-700 dark:text-grey-300",
    dot: "bg-grey-500",
  },
  PLAYED: {
    badge: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    dot: "bg-cyan-500",
  },
  COMPLETED: {
    badge: "bg-green-500/15 text-green-700 dark:text-green-300",
    dot: "bg-green-500",
  },
  RETIRED: {
    badge: "bg-stone-500/15 text-stone-700 dark:text-stone-300",
    dot: "bg-stone-500",
  },
  ABANDONED: {
    badge: "bg-red-500/15 text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
} as const;

export const GameStateIcons: Record<GameState, string> = {
  BACKLOG: "i-lucide-inbox",
  PLAYING: "i-lucide-play",
  PERIODIC: "i-lucide-repeat",
  SHELVED: "i-lucide-archive",
  PLAYED: "i-lucide-check",
  COMPLETED: "i-lucide-trophy",
  RETIRED: "i-lucide-moon",
  ABANDONED: "i-lucide-x",
} as const;
