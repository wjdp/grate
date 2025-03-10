import { updateGames } from "~/lib/steam/service";

export default async function updateGamesHandler() {
  await updateGames();
}
