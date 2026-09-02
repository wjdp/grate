import { activityQuerySchema } from "#shared/schemas/activity";
import { getDailyPlaytime } from "~~/server/services/activity";

export default defineEventHandler(async (event) => {
  const { year } = await getValidatedQuery(event, activityQuerySchema.parse);
  return { year, days: await getDailyPlaytime(year) };
});
