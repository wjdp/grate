import { getDailyPlaytime } from "~~/lib/activity";
import { activityQuerySchema } from "#shared/schemas/activity";

export default defineEventHandler(async (event) => {
  const { year } = await getValidatedQuery(event, activityQuerySchema.parse);
  return { year, days: await getDailyPlaytime(year) };
});
