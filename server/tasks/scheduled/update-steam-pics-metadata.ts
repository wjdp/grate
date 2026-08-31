import { createTask } from "~~/server/tasks/queue";

export default defineTask({
  meta: {
    name: "scheduled:update-steam-pics-metadata",
    description: "Update steam PICS metadata and library assets",
  },
  async run({ payload, context }) {
    await createTask("updateSteamPicsMetadata");
    return { result: "Success" };
  },
});
