import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { createTask, getAllTasks } from "~/server/tasks/queue";
import { TaskMap } from "~/server/tasks/router";

const TaskNameEnum = z.enum(Object.keys(TaskMap) as [keyof typeof TaskMap]);

export const tasksRouter = router({
  listTasks: publicProcedure.query(async () => {
    return getAllTasks();
  }),
  runTask: publicProcedure
    .input(
      z.object({
        taskName: TaskNameEnum,
      }),
    )
    .mutation(({ input }) => {
      createTask(input.taskName);
    }),
});
