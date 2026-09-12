import { playtimeCorrectionRouterParamsSchema } from "#shared/schemas/playtimeCorrections";
import { deletePlaytimeCorrection } from "~~/server/services/playtimeCorrections";
import { respondWithServiceErrors } from "~~/server/utils/respondWithServiceErrors";

export default defineEventHandler(async (event) => {
  const { id, correctionId } = await getValidatedRouterParams(
    event,
    playtimeCorrectionRouterParamsSchema.parse,
  );
  await respondWithServiceErrors(() =>
    deletePlaytimeCorrection(id, correctionId),
  );
  return { ok: true };
});
