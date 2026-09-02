import {
  gameRouterParamsSchema,
  setGameStateBodySchema,
} from "#shared/schemas/games";
import { setGameState } from "~~/server/services/games";

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(
    event,
    gameRouterParamsSchema.parse,
  );
  const { state } = await readValidatedBody(
    event,
    setGameStateBodySchema.parse,
  );
  const game = await setGameState(id, state);
  return { game };
});
