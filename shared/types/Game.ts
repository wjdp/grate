import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~~/server/trpc/routers";

export type GameWithSteam =
  inferRouterOutputs<AppRouter>["games"]["games"][number];
