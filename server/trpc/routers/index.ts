import { mergeRouters } from "../trpc";
import { gamesRouter } from "./games";
import { debugRouter } from "./debug";
import { tasksRouter } from "./tasks";

export const appRouter = mergeRouters(gamesRouter, debugRouter, tasksRouter);

// export type definition of API
export type AppRouter = typeof appRouter;
