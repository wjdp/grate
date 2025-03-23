export const TASK_NAMES = [
  "sleep",
  "sleepWithProgress",
  "fail",
  "populateStoreData",
  "recordPlaytimes",
  "updateGames",
  "updateSteamUser",
  "cacheSteamArt",
  "repairPlaytime",
] as const;

export type TaskName = (typeof TASK_NAMES)[number];

export type TaskState = "pending" | "in_progress" | "done" | "failed";
