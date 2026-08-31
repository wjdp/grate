import { createTask } from "~~/server/tasks/queue";

export default defineTask({
  meta: {
    name: "scheduled:update-users",
    description: "Update user information for every connected provider",
  },
  async run() {
    await createTask("updateUsers");
    return { result: "Success" };
  },
});
