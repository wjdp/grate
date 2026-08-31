import {
  runProviderJobs,
  throwOnProviderFailures,
} from "~~/server/tasks/providerRunner";
import type { Task } from "~~/server/tasks/queue";

export default async (task: Task) => {
  const { failures } = await runProviderJobs(task, [
    async (jobs, onProgress) => {
      await onProgress({ fraction: 0, message: "updating user" });
      await jobs.updateUser();
      await onProgress({ fraction: 1, message: "updated user" });
    },
  ]);
  throwOnProviderFailures(failures);
};
