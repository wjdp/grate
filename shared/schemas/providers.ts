import { z } from "zod";

export const gogAuthBodySchema = z.object({
  code: z.string().min(1),
});

export const epicAuthBodySchema = z.object({
  code: z.string().min(1),
});
