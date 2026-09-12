import { gameRouterParamsSchema } from "#shared/schemas/games";
import { getGameTimeline } from "~~/server/services/games";

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(
    event,
    gameRouterParamsSchema.parse,
  );
  return await getGameTimeline(id);
});
