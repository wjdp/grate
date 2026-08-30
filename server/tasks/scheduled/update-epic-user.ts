import { createTask } from "~~/server/tasks/queue";

export default defineTask({
  meta: {
    name: "scheduled:update-epic-user",
    description: "Update Epic user information",
  },
  async run({ payload, context }) {
    await createTask("updateEpicUser");
    return { result: "Success" };
  },
});
