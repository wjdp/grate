import { createTask } from "~~/server/tasks/queue";

export default defineTask({
  meta: {
    name: "scheduled:record-playtimes",
    description: "Record game playtimes for every connected provider",
  },
  async run({ payload, context }) {
    await createTask("recordPlaytimes");
    return { result: "Success" };
  },
});
