import { mergeGames } from "~~/lib/games";
import { mergeGamesBodySchema } from "#shared/schemas/games";

export default defineEventHandler(async (event) => {
  const { targetId, sourceIds } = await readValidatedBody(
    event,
    mergeGamesBodySchema.parse,
  );
  const game = await mergeGames(targetId, sourceIds);
  return { game };
});
