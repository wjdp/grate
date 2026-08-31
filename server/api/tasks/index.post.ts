import { createTask } from "~~/server/tasks/queue";
import { runTaskBodySchema } from "#shared/schemas/tasks";

export default defineEventHandler(async (event) => {
  const { taskName, payload } = await readValidatedBody(
    event,
    runTaskBodySchema.parse,
  );
  return await createTask(taskName, payload);
});
