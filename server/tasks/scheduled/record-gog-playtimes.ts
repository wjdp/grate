import { recordGogPlaytimes, updateGogGames } from "~~/lib/gog/service";

export default defineTask({
  meta: {
    name: "scheduled:record-gog-playtimes",
    description: "Record GOG game playtimes",
  },
  async run({ payload, context }) {
    await updateGogGames();
    console.log("Updated GOG games");
    await recordGogPlaytimes();
    console.log("Recorded GOG playtimes");
    return { result: "Success" };
  },
});
