import { useSse } from "~/composables/useSse";

export default defineEventHandler(async (event) => {
  const { eventStream, push } = useSse(event);
  push("message", { message: "Connection open" });
  return eventStream.send();
  //aa
});
