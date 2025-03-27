import sleep from "./queueable/sleep";
import sleepWithProgress from "./queueable/sleepWithProgress";
import fail from "./queueable/fail";
import populateStoreData from "./queueable/populateStoreData";
import recordPlaytimes from "./queueable/recordPlaytimes";
import updateGames from "./queueable/updateGames";
import updateSteamUser from "./queueable/updateSteamUser";
import cacheSteamArt from "./queueable/cacheSteamArt";
import updateGogUser from "./queueable/updateGogUser";

import type { TaskName } from "#shared/tasks";
import type { Task } from "~/server/tasks/queue";

export const TaskMap: { [k in TaskName]: (task: Task) => Promise<void> } = {
  sleep,
  sleepWithProgress,
  fail,
  populateStoreData,
  recordPlaytimes,
  updateGames,
  updateSteamUser,
  cacheSteamArt,
  updateGogUser,
};
