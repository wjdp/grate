import { z } from "zod";
import { GAME_STATES } from "../game-state";

export const gameIdSchema = z.coerce.number().int().positive();

export const gameRouterParamsSchema = z.object({ id: gameIdSchema });

export const recentGamesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(6),
});

export const setGameStateBodySchema = z.object({
  state: z.enum(GAME_STATES).nullable(),
});

export const mergeGamesBodySchema = z.object({
  targetId: gameIdSchema,
  sourceIds: z.array(gameIdSchema).min(1),
});

export const splitGameBodySchema = z.object({
  provider: z.enum(["steam", "gog", "epic"]),
  providerId: gameIdSchema,
});
