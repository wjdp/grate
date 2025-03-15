import sleep from "~/utils/sleep";
import type { Task } from "~/server/tasks/queue";
import { updateInProgressTask } from "~/server/tasks/queue";

export default async function sleepHandler(task: Task) {
  const ms = 100;
  const iterations = 20;
  for (let i = 0; i < iterations; i++) {
    await sleep(ms);
    await updateInProgressTask(task, {
      progress: (i + 1) / iterations,
      message: `Sleeping ${i + 1}/${iterations}`,
    });
  }
}
