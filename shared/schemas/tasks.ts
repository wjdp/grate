import { z } from "zod";
import { PROVIDER_IDS, TASK_NAMES } from "../tasks";

export const taskPayloadSchema = z.object({
  provider: z.enum(PROVIDER_IDS).optional(),
});

export const runTaskBodySchema = z.object({
  taskName: z.enum(TASK_NAMES),
  payload: taskPayloadSchema.optional(),
});
