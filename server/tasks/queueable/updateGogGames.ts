import { updateGogGames } from "~/lib/gog/service";

export default async () => {
  await updateGogGames();
};
