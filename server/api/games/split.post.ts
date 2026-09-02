import { splitGameBodySchema } from "#shared/schemas/games";
import { splitGame } from "~~/server/services/games";

export default defineEventHandler(async (event) => {
  const { provider, providerId } = await readValidatedBody(
    event,
    splitGameBodySchema.parse,
  );
  const game = await splitGame(provider, providerId);
  return { game };
});
