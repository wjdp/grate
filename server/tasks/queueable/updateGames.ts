import { queueProviderFollowUps } from "~~/server/tasks/providerFollowUps";
import {
  runProviderJobs,
  throwOnProviderFailures,
} from "~~/server/tasks/providerRunner";
import type { Task } from "~~/server/tasks/queue";

export default async (task: Task) => {
  const { runs, failures } = await runProviderJobs(task, [
    (jobs, onProgress) => jobs.updateGames(onProgress),
  ]);
  await queueProviderFollowUps({
    gamesUpdatedProviders: runs.map((run) => run.provider),
  });
  throwOnProviderFailures(failures);
};
