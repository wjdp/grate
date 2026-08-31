import { createTask } from "~~/server/tasks/queue";

export default defineTask({
  meta: {
    name: "scheduled:update-games",
    description: "Update the game library for every connected provider",
  },
  async run() {
    await createTask("updateGames");
    return { result: "Success" };
  },
});
