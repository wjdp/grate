export const TASK_NAMES = [
  "sleep",
  "sleepWithProgress",
  "fail",
  "populateStoreData",
  "recordPlaytimes",
  "updateSteamGames",
  "updateSteamUser",
  "updateSteamPicsMetadata",
  "cacheArt",
  "updateGogUser",
  "updateGogGames",
  "recordGogPlaytimes",
  "updateEpicUser",
  "updateEpicGames",
  "recordEpicPlaytimes",
] as const;

export type TaskName = (typeof TASK_NAMES)[number];

export type TaskState = "pending" | "in_progress" | "done" | "failed";
