import { defineCronHandler } from "#nuxt/cron";
import { areBackgroundJobsEnabled } from "~/lib/background-jobs";

export default defineCronHandler("everyMinute", async () => {
  if (!areBackgroundJobsEnabled()) return;
});
