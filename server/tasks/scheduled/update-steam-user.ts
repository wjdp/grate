import { createTask } from "~/server/tasks/queue";

export default defineTask({
  meta: {
    name: "scheduled:update-steam-user",
    description: "Update steam user information",
  },
  async run({ payload, context }) {
    await createTask("updateSteamUser");
    return { result: "Success" };
  },
});
