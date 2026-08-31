import type { TaskName } from "#shared/tasks";
import type { Task } from "~~/server/tasks/queue";
import cacheArt from "./queueable/cacheArt";
import fail from "./queueable/fail";
import populateStoreData from "./queueable/populateStoreData";
import recordPlaytimes from "./queueable/recordPlaytimes";
import sleep from "./queueable/sleep";
import sleepWithProgress from "./queueable/sleepWithProgress";
import sync from "./queueable/sync";
import updateGames from "./queueable/updateGames";
import updateSteamPicsMetadata from "./queueable/updateSteamPicsMetadata";
import updateUsers from "./queueable/updateUsers";

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
