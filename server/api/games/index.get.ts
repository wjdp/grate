import { getGames } from "~~/server/services/games";

export default defineEventHandler(async () => {
  const games = await getGames();
  return { games };
});
