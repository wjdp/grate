export const GAME_STATES = [
  "BACKLOG",
  "PLAYING",
  "PERIODIC",
  "SHELVED",
  "PLAYED",
  "COMPLETED",
  "RETIRED",
  "ABANDONED",
  "IGNORED",
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
  IGNORED: "Ignored",
} as const;

export interface GameStateHue {
  badge: string;
  dot: string;
  icon: string;
}

export const GameStateHues: Record<GameState, GameStateHue> = {
  BACKLOG: {
    badge: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
    icon: "text-orange-600 dark:text-orange-400",
  },
  PLAYING: {
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
    icon: "text-blue-600 dark:text-blue-400",
  },
  PERIODIC: {
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
    icon: "text-violet-600 dark:text-violet-400",
  },
  SHELVED: {
    badge: "bg-grey-500/15 text-grey-700 dark:text-grey-300",
    dot: "bg-grey-500",
    icon: "text-grey-600 dark:text-grey-400",
  },
  PLAYED: {
    badge: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    dot: "bg-cyan-500",
    icon: "text-cyan-600 dark:text-cyan-400",
  },
  COMPLETED: {
    badge: "bg-green-500/15 text-green-700 dark:text-green-300",
    dot: "bg-green-500",
    icon: "text-green-600 dark:text-green-400",
  },
  RETIRED: {
    badge: "bg-stone-500/15 text-stone-700 dark:text-stone-300",
    dot: "bg-stone-500",
    icon: "text-stone-600 dark:text-stone-400",
  },
  ABANDONED: {
    badge: "bg-red-500/15 text-red-700 dark:text-red-300",
    dot: "bg-red-500",
    icon: "text-red-600 dark:text-red-400",
  },
  IGNORED: {
    badge: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    dot: "bg-slate-500",
    icon: "text-slate-600 dark:text-slate-400",
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
  IGNORED: "i-lucide-ban",
} as const;
