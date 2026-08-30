import type { Game, GogGame, SteamGame } from "@prisma/client";

export interface GameWithProviders extends Game {
  steamGame: SteamGame | null;
  gogGame: GogGame | null;
}
