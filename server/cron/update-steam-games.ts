import { defineCronHandler } from "#nuxt/cron";
import { updateGames } from "~/lib/steam/service";

export default defineCronHandler("everyThirtyMinutes", async () => {
  await updateGames();
  console.log("Updated steam games");
});
