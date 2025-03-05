import { z } from 'zod'
import { publicProcedure, router } from '../trpc'
import { getGames } from '~/lib/games';

export const gamesRouter = router({
  games: publicProcedure
    .query(async ({ input }) => {
      const games = await getGames();
      return {games};
    }),
})
