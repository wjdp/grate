import { recordEpicPlaytimes } from "~~/lib/epic/service";

export default async () => {
  await recordEpicPlaytimes();
};
