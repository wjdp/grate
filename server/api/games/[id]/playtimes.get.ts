import { getGamePlaytimes } from "~~/lib/games";
import { gameRouterParamsSchema } from "#shared/schemas/games";

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(
    event,
    gameRouterParamsSchema.parse,
  );
  const playtimes = await getGamePlaytimes(id);
  return { playtimes };
});
