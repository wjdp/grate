import { useSseEvent } from "~~/server/sse";

export default defineEventHandler(async () => {
  const { push } = useSseEvent();
  push("message", { message: "Hello World" });
  push("notification", { title: "Hello", message: "World" });
});
