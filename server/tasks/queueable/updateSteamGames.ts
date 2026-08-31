import { updateGames } from "~~/lib/steam/service";
import { createTask } from "~~/server/tasks/queue";

export default async () => {
  await updateGames();
  // New games need their PICS metadata and library assets straight away.
  await createTask("updateSteamPicsMetadata");
};
