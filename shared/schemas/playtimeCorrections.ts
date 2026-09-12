import { z } from "zod";
import { isValidFuzzyDate } from "../fuzzyDate";
import { gameIdSchema } from "./games";

const fuzzyDateSchema = z
  .string()
  .refine(isValidFuzzyDate, { message: "Not a valid fuzzy date" });

const playtimeCorrectionFields = {
  snapshotId: z.number().int().positive().nullable(),
  minutes: z.number().int().positive(),
  playedFrom: fuzzyDateSchema,
  playedTo: fuzzyDateSchema,
  note: z.string().nullable(),
};

export const createPlaytimeCorrectionBodySchema = z.object({
  provider: z.enum(["steam", "gog", "epic"]),
  providerId: z.number().int().positive(),
  ...playtimeCorrectionFields,
  note: playtimeCorrectionFields.note.optional(),
});

export const patchPlaytimeCorrectionBodySchema = z
  .object(playtimeCorrectionFields)
  .partial();

export const playtimeCorrectionRouterParamsSchema = z.object({
  id: gameIdSchema,
  correctionId: z.coerce.number().int().positive(),
});

export type CreatePlaytimeCorrectionBody = z.infer<
  typeof createPlaytimeCorrectionBodySchema
>;
export type PatchPlaytimeCorrectionBody = z.infer<
  typeof patchPlaytimeCorrectionBodySchema
>;
