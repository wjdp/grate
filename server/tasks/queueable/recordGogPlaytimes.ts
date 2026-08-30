import { recordGogPlaytimes } from "~/lib/gog/service";

export default async () => {
  await recordGogPlaytimes();
};
