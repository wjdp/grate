import { ProviderLabels } from "#shared/providers";
import type { ProviderId } from "#shared/tasks";
import {
  type OnProgress,
  PROVIDER_JOBS,
  type ProviderJobs,
} from "~~/lib/providerJobs";
import type { Task } from "~~/server/tasks/queue";
import { updateInProgressTask } from "~~/server/tasks/queue";

export type ProviderStep<T> = (
  jobs: ProviderJobs,
  onProgress: OnProgress,
) => Promise<T>;

export interface ProviderRun<T> {
  provider: ProviderId;
  results: T[];
}

export interface ProviderFailure {
  provider: ProviderId;
  error: unknown;
}

export interface ProviderRunOutcome<T> {
  runs: ProviderRun<T>[];
  failures: ProviderFailure[];
}

async function selectActiveProviders<T>(
  task: Task,
  registry: ProviderJobs[],
): Promise<ProviderJobs[]> {
  const requested = task.payload?.provider;
  const selected = requested
    ? registry.filter((jobs) => jobs.provider === requested)
    : registry;
  const active: ProviderJobs[] = [];
  for (const jobs of selected) {
    if (await jobs.isActive()) {
      active.push(jobs);
    } else {
      updateInProgressTask(task, {
        message: `${ProviderLabels[jobs.provider]}: not connected, skipped`,
      });
    }
  }
  return active;
}

export async function runProviderJobs<T>(
  task: Task,
  steps: ProviderStep<T>[],
  registry: ProviderJobs[] = PROVIDER_JOBS,
): Promise<ProviderRunOutcome<T>> {
  const active = await selectActiveProviders(task, registry);
  const totalSteps = active.length * steps.length;
  const runs: ProviderRun<T>[] = [];
  const failures: ProviderFailure[] = [];

  for (const [providerIndex, jobs] of active.entries()) {
    const label = ProviderLabels[jobs.provider];
    const results: T[] = [];
    try {
      for (const [stepIndex, step] of steps.entries()) {
        const stepOffset = providerIndex * steps.length + stepIndex;
        const onProgress: OnProgress = ({ fraction, message }) => {
          updateInProgressTask(task, {
            progress: (stepOffset + (fraction ?? 0)) / totalSteps,
            message: `${label}: ${message}`,
          });
        };
        results.push(await step(jobs, onProgress));
      }
      runs.push({ provider: jobs.provider, results });
    } catch (error) {
      console.error(`${label} job failed: ${error}`);
      failures.push({ provider: jobs.provider, error });
      updateInProgressTask(task, { message: `${label}: failed` });
    }
  }

  return { runs, failures };
}

export function throwOnProviderFailures(failures: ProviderFailure[]) {
  if (failures.length === 0) return;
  const detail = failures
    .map(({ provider, error }) => `${ProviderLabels[provider]}: ${error}`)
    .join("; ");
  const providers = failures
    .map(({ provider }) => ProviderLabels[provider])
    .join(", ");
  throw new Error(`Failed for ${providers} (${detail})`);
}
