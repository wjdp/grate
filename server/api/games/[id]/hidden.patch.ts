import {
  gameRouterParamsSchema,
  setGameHiddenBodySchema,
} from "#shared/schemas/games";
import { setGameHidden } from "~~/server/services/games";

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(
    event,
    gameRouterParamsSchema.parse,
  );
  const { hidden } = await readValidatedBody(
    event,
    setGameHiddenBodySchema.parse,
  );
  const game = await setGameHidden(id, hidden);
  return { game };
});
