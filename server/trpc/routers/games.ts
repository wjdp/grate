import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { getGame, getGamePlaytimes, getGames, setGameState } from "~/lib/games";
import { GameState } from "@prisma/client";

const gameId = z.number().positive();
const gameInput = z.object({ id: gameId });
const GameStateEnum = z.nativeEnum(GameState);

export default router({
  games: publicProcedure.query(async ({ input }) => {
    const games = await getGames();
    return { games };
  }),
  game: publicProcedure.input(gameInput).query(async ({ input }) => {
    const game = await getGame(input.id);
    return { game };
  }),
  gamePlaytimes: publicProcedure.input(gameInput).query(async ({ input }) => {
    const playtimes = await getGamePlaytimes(input.id);
    return { playtimes };
  }),

  setGameState: publicProcedure
    .input(z.object({ id: gameId, state: z.union([GameStateEnum, z.null()]) }))
    .mutation(async ({ input }) => {
      const game = await setGameState(input.id, input.state);
      return { game };
    }),
});
