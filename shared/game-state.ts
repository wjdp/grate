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
