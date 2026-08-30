import { getGames } from "~~/lib/games";

export default defineEventHandler(async () => {
  const games = await getGames();
  return { games };
});
