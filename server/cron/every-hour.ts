import { defineCronHandler } from "#nuxt/cron";
import { areBackgroundJobsEnabled } from "~/lib/background-jobs";
import { recordPlaytimes, updateGames } from "~/lib/steam/service";

export default defineCronHandler("hourly", async () => {
  if (!areBackgroundJobsEnabled()) return;
  await updateGames();
  console.log("Updated steam games");
  await recordPlaytimes();
  console.log("Recorded steam playtimes");
});
