import type { RecordPlaytimesResult } from "~~/lib/providerJobs";
import type { Task } from "~~/server/tasks/queue";
import { queueProviderFollowUps } from "~~/server/tasks/providerFollowUps";
import {
  runProviderJobs,
  throwOnProviderFailures,
} from "~~/server/tasks/providerRunner";

export default async (task: Task) => {
  const { runs, failures } = await runProviderJobs<
    RecordPlaytimesResult | undefined
  >(task, [
    async (jobs, onProgress) => {
      await onProgress({ fraction: 0, message: "updating user" });
      await jobs.updateUser();
      return undefined;
    },
    async (jobs, onProgress) => {
      await jobs.updateGames(onProgress);
      return undefined;
    },
    (jobs, onProgress) => jobs.recordPlaytimes(onProgress),
  ]);
  await queueProviderFollowUps({
    gamesUpdatedProviders: runs.map((run) => run.provider),
    playtimeRuns: runs.flatMap((run) =>
      run.results
        .filter((result) => !!result)
        .map((result) => ({ provider: run.provider, result })),
    ),
  });
  throwOnProviderFailures(failures);
};
