import { recordPlaytimes } from "~/lib/steam/service"

export default defineEventHandler(async (event) => {
  await recordPlaytimes()
    return { status: "ok" }
})
