import { defineCronHandler } from "#nuxt/cron";
import { areBackgroundJobsEnabled } from "~/lib/background-jobs";
import {
  findGameNeedingStoreData,
  populateStoreData,
} from "~/lib/steam/service";

export default defineCronHandler("everyMinute", async () => {
  if (!areBackgroundJobsEnabled()) return;
  const game = await findGameNeedingStoreData();
  if (!game) {
    return;
  }
  console.log(`Found game needing store data: ${game.appId}`);
  try {
    await populateStoreData(game.appId);
    console.log(`Populated store data for game ${game.appId}`);
  } catch (error) {
    console.error(
      `Failed to populate store data for game ${game.appId}: ${error}`,
    );
  }
});
