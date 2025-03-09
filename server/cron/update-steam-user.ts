import { defineCronHandler } from "#nuxt/cron";
import { areBackgroundJobsEnabled } from "~/lib/background-jobs";
import { updateUser } from "~/lib/steam/service";

export default defineCronHandler("everyFifteenMinutes", async () => {
  if (!areBackgroundJobsEnabled()) return;
  await updateUser();
  console.log("Updated steam user");
});
