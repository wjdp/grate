import { settingsPatchSchema } from "#shared/schemas/settings";
import { updateSettings } from "~~/lib/settings";

export default defineEventHandler(async (event) => {
  const patch = await readValidatedBody(event, settingsPatchSchema.parse);
  return await updateSettings(patch);
});
