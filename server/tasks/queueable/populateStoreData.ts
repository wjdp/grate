import {
  findGamesNeedingStoreData,
  populateStoreData,
} from "~~/lib/steam/service";
import sleep from "#shared/utils/sleep";
import { updateInProgressTask } from "~~/server/tasks/queue";
import type { Task } from "~~/server/tasks/queue";

export default async (task: Task) => {
  const games = await findGamesNeedingStoreData();
  const total = games.length;
  for (const [index, game] of games.entries()) {
    console.log(`Populating store data for game ${game.appId}`);
    await populateStoreData(game.appId);
    const done = index + 1;
    await updateInProgressTask(task, {
      progress: done / total,
      done,
      total,
      message: `Populated store data for ${game.name}`,
    });
    await sleep(1500);
  }
};
