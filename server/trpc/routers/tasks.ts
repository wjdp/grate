import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { testTasks } from "~/server/tasks/queue";

export const tasksRouter = router({
  runTask: publicProcedure
    .input(
      z.object({
        taskName: z.string(),
      }),
    )
    .mutation(({ input }) => {
      testTasks();
    }),
});
