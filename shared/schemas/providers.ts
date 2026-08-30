import { z } from "zod";

export const gogAuthBodySchema = z.object({
  code: z.string().min(1),
});

export const steamAuthBodySchema = z.object({
  apiKey: z.string().min(1),
  profile: z.string().min(1),
});

export const epicAuthBodySchema = z.object({
  code: z.string().min(1),
});
