import { queueProviderFollowUps } from "~~/server/tasks/providerFollowUps";
import {
  runProviderJobs,
  throwOnProviderFailures,
} from "~~/server/tasks/providerRunner";
import type { Task } from "~~/server/tasks/queue";

export default async (task: Task) => {
  const { runs, failures } = await runProviderJobs(task, [
    (jobs, onProgress) => jobs.recordPlaytimes(onProgress),
  ]);
  await queueProviderFollowUps({
    playtimeRuns: runs.flatMap((run) =>
      run.results.map((result) => ({ provider: run.provider, result })),
    ),
  });
  throwOnProviderFailures(failures);
};
