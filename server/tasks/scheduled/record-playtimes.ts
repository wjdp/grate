import { recordPlaytimes, updateGames } from "~/lib/steam/service";

export default defineTask({
  meta: {
    name: "scheduled:record-playtimes",
    description: "Record game playtimes",
  },
  async run({ payload, context }) {
    await updateGames();
    console.log("Updated steam games");
    await recordPlaytimes();
    console.log("Recorded steam playtimes");
    return { result: "Success" };
  },
});
