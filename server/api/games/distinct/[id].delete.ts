import { distinctPairRouterParamsSchema } from "#shared/schemas/games";
import { unmarkDistinct } from "~~/server/services/duplicates";

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(
    event,
    distinctPairRouterParamsSchema.parse,
  );
  await unmarkDistinct(id);
  return { ok: true };
});
