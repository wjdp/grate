import { gameRouterParamsSchema } from "#shared/schemas/games";
import { getGamePlaytimes } from "~~/server/services/games";

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(
    event,
    gameRouterParamsSchema.parse,
  );
  const playtimes = await getGamePlaytimes(id);
  return { playtimes };
});
