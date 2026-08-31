import { markDistinct } from "~~/lib/duplicates";
import { distinctPairBodySchema } from "#shared/schemas/games";

export default defineEventHandler(async (event) => {
  const { gameAId, gameBId } = await readValidatedBody(
    event,
    distinctPairBodySchema.parse,
  );
  const pair = await markDistinct(gameAId, gameBId);
  return { pair };
});
