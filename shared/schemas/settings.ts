import { IANAZone } from "luxon";
import { z } from "zod";

export const settingsPatchSchema = z
  .object({
    timezone: z
      .string()
      .min(1)
      .refine((zone) => IANAZone.isValidZone(zone), {
        message: "Unknown timezone",
      })
      .nullable(),
    dayBoundaryHour: z.number().int().min(0).max(23),
  })
  .partial();

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
