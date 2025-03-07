import type { Game } from "@prisma/client";
import type { SteamGame } from "@prisma/client";
import { GameState } from "@prisma/client";

export interface GameWithSteam extends Game {
  steamGame: SteamGame | null;
}
