import { unmarkDistinct } from "~~/lib/duplicates";
import { distinctPairRouterParamsSchema } from "#shared/schemas/games";

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(
    event,
    distinctPairRouterParamsSchema.parse,
  );
  await unmarkDistinct(id);
  return { ok: true };
});
