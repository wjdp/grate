import { gameRouterParamsSchema } from "#shared/schemas/games";
import { getGameTimeline } from "~~/lib/games";

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(
    event,
    gameRouterParamsSchema.parse,
  );
  const sessions = await getGameTimeline(id);
  return { sessions };
});
