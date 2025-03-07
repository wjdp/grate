import type { Game, SteamGame } from "@prisma/client";

export interface GameWithSteam extends Game {
  steamGame: SteamGame | null;
}
