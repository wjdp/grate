export const TASK_NAMES = [
  "sleep",
  "fail",
  "populateStoreData",
  "recordPlaytimes",
  "updateGames",
  "updateSteamUser",
] as const;

export type TaskName = (typeof TASK_NAMES)[number];
