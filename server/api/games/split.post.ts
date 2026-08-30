import { splitGame } from "~~/lib/games";
import { splitGameBodySchema } from "#shared/schemas/games";

export default defineEventHandler(async (event) => {
  const { provider, providerId } = await readValidatedBody(
    event,
    splitGameBodySchema.parse,
  );
  const game = await splitGame(provider, providerId);
  return { game };
});
