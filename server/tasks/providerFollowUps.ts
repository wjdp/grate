import type { ProviderId, TaskName } from "#shared/tasks";
import type { RecordPlaytimesResult } from "~~/lib/providerJobs";
import { createTask } from "~~/server/tasks/queue";

export interface PlaytimeRun {
  provider: ProviderId;
  result: RecordPlaytimesResult;
}

export interface ProviderFollowUps {
  gamesUpdatedProviders?: ProviderId[];
  playtimeRuns?: PlaytimeRun[];
}

export async function queueProviderFollowUps({
  gamesUpdatedProviders = [],
  playtimeRuns = [],
}: ProviderFollowUps) {
  const enrichmentTasks = new Set<TaskName>();
  // New steam games need their PICS metadata and library assets straight away.
  if (gamesUpdatedProviders.includes("steam")) {
    enrichmentTasks.add("updateSteamPicsMetadata");
  }
  if (playtimeRuns.some(({ result }) => result.gamesCreated > 0)) {
    enrichmentTasks.add("updateSteamPicsMetadata");
    enrichmentTasks.add("populateStoreData");
    enrichmentTasks.add("cacheArt");
  }
  for (const name of enrichmentTasks) {
    await createTask(name);
  }
  for (const { provider, result } of playtimeRuns) {
    if (provider !== "steam" && result.unknownGames > 0) {
      await createTask("updateGames", { provider });
    }
  }
}
