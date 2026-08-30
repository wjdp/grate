import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~~/server/trpc/routers";

export type GameWithProviders =
  inferRouterOutputs<AppRouter>["games"]["games"][number];
