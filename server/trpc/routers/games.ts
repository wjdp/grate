import { z } from 'zod'
import { publicProcedure, router } from '../trpc'
import { getGame, getGamePlaytimes, getGames } from '~/lib/games';

const gameId = z.number().positive();
const gameInput = z.object({id: gameId});

export const gamesRouter = router({
  games: publicProcedure
    .query(async ({ input }) => {
      const games = await getGames();
      return {games};
    }),
  game: publicProcedure
    .input(gameInput)
    .query(async ({ input }) => {
        const game = await getGame(input.id);
        return {game};
    }
  ),
  gamePlaytimes: publicProcedure
    .input(gameInput)
    .query(async ({ input }) => {
        const playtimes = await getGamePlaytimes(input.id);
        return {playtimes};
    }
  ),

})
