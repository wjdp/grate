import { recordEpicPlaytimes, updateEpicGames } from "~~/lib/epic/service";

export default defineTask({
  meta: {
    name: "scheduled:record-epic-playtimes",
    description: "Record Epic game playtimes",
  },
  async run({ payload, context }) {
    await updateEpicGames();
    console.log("Updated Epic games");
    await recordEpicPlaytimes();
    console.log("Recorded Epic playtimes");
    return { result: "Success" };
  },
});
