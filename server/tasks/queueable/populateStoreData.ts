import {
  findGamesNeedingStoreData,
  populateStoreData,
} from "~/lib/steam/service";
import sleep from "~/utils/sleep";

export default async () => {
  const games = await findGamesNeedingStoreData();
  for (const game of games) {
    console.log(`Populating store data for game ${game.appId}`);
    await populateStoreData(game.appId);
    await sleep(1500);
  }
};
