import { getGames } from "~/lib/games";
import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  const games = await getGames();
  return { games };
});
