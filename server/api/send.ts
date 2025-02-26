import { useSseEvent } from "~/composables/useSse"

export default defineEventHandler(async (event) => {
  const {send} = useSseEvent("default")
  send({message: "Hello World this was me!"})
})
