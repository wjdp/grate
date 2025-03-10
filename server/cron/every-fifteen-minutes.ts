import { defineCronHandler } from "#nuxt/cron";
import { areBackgroundJobsEnabled } from "~/lib/background-jobs";
import { createTask } from "~/server/tasks/queue";

export default defineCronHandler("everyFifteenMinutes", async () => {
  if (!areBackgroundJobsEnabled()) return;
  await createTask("updateSteamUser");
});
