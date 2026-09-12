import { gameRouterParamsSchema } from "#shared/schemas/games";
import { listPlaytimeCorrections } from "~~/server/services/playtimeCorrections";
import { respondWithServiceErrors } from "~~/server/utils/respondWithServiceErrors";

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(
    event,
    gameRouterParamsSchema.parse,
  );
  const corrections = await respondWithServiceErrors(() =>
    listPlaytimeCorrections(id),
  );
  return { corrections };
});
