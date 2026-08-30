import { z } from "zod";
import { TASK_NAMES } from "../tasks";

export const runTaskBodySchema = z.object({
  taskName: z.enum(TASK_NAMES),
});
