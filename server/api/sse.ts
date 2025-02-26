import { useSse } from "~/composables/useSse"

export default defineEventHandler(async (event) => {
    const { send, close } = useSse(event, "default")

    let interval = setInterval(() => {
        send((id) => ({ id, message: "Hello!"}))
    }, 1000)

    event.node.req.on("close", () => clearInterval(interval))
})
