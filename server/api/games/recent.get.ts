import { getRecentGames } from "~~/lib/games";
import { recentGamesQuerySchema } from "#shared/schemas/games";

export default defineEventHandler(async (event) => {
  const { limit } = await getValidatedQuery(
    event,
    recentGamesQuerySchema.parse,
  );
  const games = await getRecentGames(limit);
  return { games };
});
