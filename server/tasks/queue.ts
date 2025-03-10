import { TaskName } from "~/server/tasks/router";

const CURRENT_TASK_ID = "currentTaskId";
const LAST_TASK_KEY = "lastTaskId";

interface Task {
  id: number;
  name: TaskName;
  status: "pending" | "in_progress" | "done" | "failed";
}

function getTaskKey(taskId: number) {
  return `task:${taskId}`;
}

async function getTask(id: number): Promise<Task> {
  const storage = await useStorage();
  return (await storage.get(getTaskKey(id))) as Task;
}

export async function getCurrentTask() {
  const storage = await useStorage();
  const currentTaskIdRaw = await storage.get(CURRENT_TASK_ID);
  if (!currentTaskIdRaw) {
    return null;
  }
  const currentTaskId = parseInt(currentTaskIdRaw);
  return await getTask(currentTaskId);
}

async function getNewTaskId() {
  const storage = await useStorage();
  const lastTaskId = await storage.get(LAST_TASK_KEY);
  const newTaskId = lastTaskId ? parseInt(lastTaskId) + 1 : 1;
  await storage.set(LAST_TASK_KEY, newTaskId);
  return newTaskId;
}

export async function updateTaskStatus(taskId: number, status: Task["status"]) {
  const storage = await useStorage();
  const task = await getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  task.status = status;
  await storage.set(getTaskKey(taskId), task);
  console.log(`Task ${taskId} ${status}`);
}

export async function completeTask(taskId: number, status: "done" | "failed") {
  await updateTaskStatus(taskId, status);
  const storage = await useStorage();
  // check if there's a new task
  const nextTask = await getTask(taskId + 1);
  if (nextTask) {
    await storage.set(CURRENT_TASK_ID, nextTask.id);
  } else {
    await storage.remove(CURRENT_TASK_ID);
  }
  return nextTask;
}

export async function createTask(taskName: TaskName): Promise<Task> {
  const taskId = await getNewTaskId();
  const task: Task = {
    id: taskId,
    name: taskName,
    status: "pending",
  };
  const storage = await useStorage();
  await storage.set(getTaskKey(taskId), task);
  const currentTaskId = await storage.get(CURRENT_TASK_ID);
  if (!currentTaskId) {
    await storage.set(CURRENT_TASK_ID, taskId);
  }
  console.log(`Task ${taskId}:${taskName} created`);
  runTask("handler");
  return task;
}

async function getAllTasks() {
  const storage = await useStorage();
  return (await storage.getKeys("task:")).map((key) =>
    parseInt(key.split(":")[1]),
  );
}
