import sleep from "./queueable/sleep";
import fail from "./queueable/fail";
import populateStoreData from "./queueable/populateStoreData";
import recordPlaytimes from "./queueable/recordPlaytimes";
import updateGames from "./queueable/updateGames";
import updateSteamUser from "./queueable/updateSteamUser";
import cacheSteamArt from "./queueable/cacheSteamArt";

import type { TaskName } from "#shared/tasks";

export const TaskMap: { [k in TaskName]: () => Promise<void> } = {
  sleep,
  fail,
  populateStoreData,
  recordPlaytimes,
  updateGames,
  updateSteamUser,
  cacheSteamArt,
};
