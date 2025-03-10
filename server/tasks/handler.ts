import sleep from "~/utils/sleep";
import { completeTask, getCurrentTask, updateTaskStatus } from "./queue";
import { useSseEvent } from "~/composables/useSse";

export default defineTask({
  meta: {
    name: "handler",
    description: "Handle tasks on the task queue",
  },
  async run({ payload, context }) {
    const { push } = useSseEvent();
    const currentTask = await getCurrentTask();
    if (!currentTask) {
      console.log("no tasks to run");
      return { result: "No tasks to run" };
    }
    if (currentTask.status != "pending") {
      console.log("task already running");
      return { result: "Task already running" };
    }
    await updateTaskStatus(currentTask.id, "in_progress");
    push("message", { message: `task ${currentTask.id} in progress` });
    console.log(`Running task ${currentTask.id}`);
    await sleep(2000);
    await completeTask(currentTask.id, "done");
    push("message", { message: `task ${currentTask.id} completed` });
    setTimeout(() => runTask("handler"), 100);
    console.log("Task completed, triggered new task handler");
    return { result: "Success" };
  },
});
