import { recordPlaytimes } from "~/lib/steam/service";

export default async () => {
  await recordPlaytimes();
};
