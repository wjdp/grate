import { updateGames } from "~/lib/steam/service"

export default defineEventHandler(async (event) => {
  await updateGames()
    return { status: "ok" }
})
