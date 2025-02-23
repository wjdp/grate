import { updateUser } from "~/lib/steam/service"

export default defineEventHandler(async (event) => {
  await updateUser()
    return { status: "ok" }
})
