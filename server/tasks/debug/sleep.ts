import sleep from "~/utils/sleep";

export default defineTask({
  meta: {
    name: "debug:sleep",
    description: "Sleep for a while",
  },
  async run({ payload, context }) {
    console.log("Sleeping for a while...");
    console.log(payload);
    console.log(context);
    await sleep(5000);
    return { result: "Success" };
  },
});
