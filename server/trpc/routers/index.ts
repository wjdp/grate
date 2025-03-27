import { mergeRouters } from "../trpc";
import gamesRouter from "./games";
import debugRouter from "./debug";
import tasksRouter from "./tasks";
import providersRouter from "./providers";

export const appRouter = mergeRouters(
  gamesRouter,
  debugRouter,
  tasksRouter,
  providersRouter,
);

// export type definition of API
export type AppRouter = typeof appRouter;
