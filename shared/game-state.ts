import type { GameState } from "@prisma/client";

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
