import { defineCronHandler } from "#nuxt/cron";
import { recordPlaytimes, updateGames } from "~/lib/steam/service";

export default defineCronHandler("hourly", async () => {
  await updateGames();
  console.log("Updated steam games");
  await recordPlaytimes();
  console.log("Recorded steam playtimes");
});
