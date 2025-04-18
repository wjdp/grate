import sleep from "./queueable/sleep";
import sleepWithProgress from "./queueable/sleepWithProgress";
import fail from "./queueable/fail";
import populateStoreData from "./queueable/populateStoreData";
import recordPlaytimes from "./queueable/recordPlaytimes";
import updateSteamGames from "./queueable/updateSteamGames";
import updateSteamUser from "./queueable/updateSteamUser";
import cacheSteamArt from "./queueable/cacheSteamArt";
import updateGogUser from "./queueable/updateGogUser";
import updateGogGames from "./queueable/updateGogGames";

import type { TaskName } from "#shared/tasks";
import type { Task } from "~/server/tasks/queue";

export const TaskMap: { [k in TaskName]: (task: Task) => Promise<void> } = {
  sleep,
  sleepWithProgress,
  fail,
  populateStoreData,
  recordPlaytimes,
  updateSteamGames,
  updateSteamUser,
  cacheSteamArt,
  updateGogUser,
  updateGogGames,
};
