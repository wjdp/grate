import sleep from "./queueable/sleep";
import fail from "./queueable/fail";
import { TaskName } from "#shared/tasks";

export const TaskMap: { [k in TaskName]: () => Promise<void> } = {
  sleep: sleep,
  fail: fail,
};
