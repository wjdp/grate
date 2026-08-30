import { createTask } from "~~/server/tasks/queue";
import { runTaskBodySchema } from "#shared/schemas/tasks";

export default defineEventHandler(async (event) => {
  const { taskName } = await readValidatedBody(event, runTaskBodySchema.parse);
  return await createTask(taskName);
});
