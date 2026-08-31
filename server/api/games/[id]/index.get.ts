import { gameRouterParamsSchema } from "#shared/schemas/games";
import { getGame } from "~~/lib/games";

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(
    event,
    gameRouterParamsSchema.parse,
  );
  const game = await getGame(id);
  if (!game) {
    throw createError({ statusCode: 404, statusMessage: "Game not found" });
  }
  return { game };
});
