import { getSettings } from "~~/lib/settings";

export default defineEventHandler(async () => {
  return await getSettings();
});
