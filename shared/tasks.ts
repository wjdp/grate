export const TASK_NAMES = [
  "sleep",
  "sleepWithProgress",
  "fail",
  "sync",
  "updateUsers",
  "updateGames",
  "recordPlaytimes",
  "populateStoreData",
  "updateSteamPicsMetadata",
  "cacheArt",
] as const;

export type TaskName = (typeof TASK_NAMES)[number];

export type TaskState = "pending" | "in_progress" | "done" | "failed";

export const PROVIDER_IDS = ["steam", "gog", "epic"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export interface TaskPayload {
  provider?: ProviderId;
}
