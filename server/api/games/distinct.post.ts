import { distinctPairBodySchema } from "#shared/schemas/games";
import { markDistinct } from "~~/server/services/duplicates";

export default defineEventHandler(async (event) => {
  const { gameAId, gameBId } = await readValidatedBody(
    event,
    distinctPairBodySchema.parse,
  );
  const pair = await markDistinct(gameAId, gameBId);
  return { pair };
});
