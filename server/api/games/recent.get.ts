import { recentGamesQuerySchema } from "#shared/schemas/games";
import { getRecentGames } from "~~/lib/games";

export default defineEventHandler(async (event) => {
  const { limit } = await getValidatedQuery(
    event,
    recentGamesQuerySchema.parse,
  );
  const games = await getRecentGames(limit);
  return { games };
});
