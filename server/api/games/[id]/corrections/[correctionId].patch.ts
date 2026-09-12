import {
  patchPlaytimeCorrectionBodySchema,
  playtimeCorrectionRouterParamsSchema,
} from "#shared/schemas/playtimeCorrections";
import { updatePlaytimeCorrection } from "~~/server/services/playtimeCorrections";
import { respondWithServiceErrors } from "~~/server/utils/respondWithServiceErrors";

export default defineEventHandler(async (event) => {
  const { id, correctionId } = await getValidatedRouterParams(
    event,
    playtimeCorrectionRouterParamsSchema.parse,
  );
  const patch = await readValidatedBody(
    event,
    patchPlaytimeCorrectionBodySchema.parse,
  );
  const correction = await respondWithServiceErrors(() =>
    updatePlaytimeCorrection(id, correctionId, patch),
  );
  return { correction };
});
