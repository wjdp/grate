import { gameRouterParamsSchema } from "#shared/schemas/games";
import { createPlaytimeCorrectionBodySchema } from "#shared/schemas/playtimeCorrections";
import { createPlaytimeCorrection } from "~~/server/services/playtimeCorrections";
import { respondWithServiceErrors } from "~~/server/utils/respondWithServiceErrors";

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(
    event,
    gameRouterParamsSchema.parse,
  );
  const body = await readValidatedBody(
    event,
    createPlaytimeCorrectionBodySchema.parse,
  );
  const correction = await respondWithServiceErrors(() =>
    createPlaytimeCorrection(id, body),
  );
  return { correction };
});
