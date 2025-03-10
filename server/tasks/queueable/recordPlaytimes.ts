import { recordPlaytimes } from "~/lib/steam/service";

export default async function recordPlaytimesHandler() {
  await recordPlaytimes();
}
