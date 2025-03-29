import { updateGames } from "~/lib/steam/service";

export default async () => {
  await updateGames();
};
