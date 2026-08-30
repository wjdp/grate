import { createTask } from "~~/server/tasks/queue";

export default defineTask({
  meta: {
    name: "scheduled:update-gog-user",
    description: "Update GOG user information",
  },
  async run({ payload, context }) {
    await createTask("updateGogUser");
    return { result: "Success" };
  },
});
