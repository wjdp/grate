import sleep from "./queueable/sleep";
import sleepWithProgress from "./queueable/sleepWithProgress";
import fail from "./queueable/fail";
import sync from "./queueable/sync";
import updateUsers from "./queueable/updateUsers";
import updateGames from "./queueable/updateGames";
import recordPlaytimes from "./queueable/recordPlaytimes";
import populateStoreData from "./queueable/populateStoreData";
import updateSteamPicsMetadata from "./queueable/updateSteamPicsMetadata";
import cacheArt from "./queueable/cacheArt";

import type { TaskName } from "#shared/tasks";
import type { Task } from "~~/server/tasks/queue";

export const TaskMap: { [k in TaskName]: (task: Task) => Promise<void> } = {
  sleep,
  sleepWithProgress,
  fail,
  sync,
  updateUsers,
  updateGames,
  recordPlaytimes,
  populateStoreData,
  updateSteamPicsMetadata,
  cacheArt,
};
