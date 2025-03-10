import { completeTask, getCurrentTask, updateTaskStatus } from "./queue";
import { useSseEvent } from "~/composables/useSse";
import { TaskMap } from "~/server/tasks/router";

const queueNextTask = () => {
  // Loop this task to pick up the next task
  // The setTimeout is needed as Nitro will prevent the task from running
  // while this instance is still running.
  setTimeout(() => runTask("handler"), 100);
};

export default defineTask({
  meta: {
    name: "handler",
    description: "Handle tasks on the task queue",
  },
  async run({ payload, context }) {
    const { push } = useSseEvent();
    const currentTask = await getCurrentTask();
    if (!currentTask) {
      push("message", { message: "All tasks completed" });
      return { result: "No tasks to run" };
    }
    const taskNameLog = `${currentTask.id}:${currentTask.name}`;
    if (currentTask.status != "pending") {
      console.log("task already running");
      return { result: "Task already running" };
    }
    const taskFunction = TaskMap[currentTask.name];
    if (!taskFunction) {
      console.error(`Task function not found for task ${taskNameLog}`);
      await updateTaskStatus(currentTask.id, "failed");
      push("message", { message: `task ${taskNameLog} failed` });
      return { result: "Task function not found" };
    }
    await updateTaskStatus(currentTask.id, "in_progress");
    push("message", { message: `task ${taskNameLog} in progress` });
    console.log(`Running task ${taskNameLog}`);
    try {
      await taskFunction(currentTask.id);
      await completeTask(currentTask.id, "done");
    } catch (error) {
      console.error(`Task ${taskNameLog} failed: ${error}`);
      await completeTask(currentTask.id, "failed");
      push("message", { message: `task ${taskNameLog} failed` });
      queueNextTask();
      return { result: "Task failed" };
    }
    push("message", { message: `task ${taskNameLog} completed` });

    console.log("Task completed, triggered new task handler");
    queueNextTask();
    return { result: "Success" };
  },
});
