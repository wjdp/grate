import { updateUser } from "~/lib/steam/service";

export default async function updateSteamUserHandler() {
  await updateUser();
}
