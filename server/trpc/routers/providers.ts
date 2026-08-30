import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { createOrUpdateGogUser } from "~/lib/gog/service";
import { createOrUpdateEpicUser, getEpicUser } from "~/lib/epic/service";
import { createOrUpdateSteamUser, getSteamUser } from "~/lib/steam/service";
import tryCatch from "~/utils/tryCatch";
import { TRPCError } from "@trpc/server";

export default router({
  gogAuth: publicProcedure
    .input(
      z.object({
        code: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { data: token, error } = await tryCatch(
        createOrUpdateGogUser(input.code),
      );
      if (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${error.message}`,
        });
      }
      return { token };
    }),

  steamStatus: publicProcedure.query(async () => {
    const steamUser = await getSteamUser();
    if (!steamUser) return null;
    return {
      steamId: steamUser.steamId,
      personaName: steamUser.personaName,
      hasApiKey: !!steamUser.apiKey,
    };
  }),

  steamAuth: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        profile: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { data: steamUser, error } = await tryCatch(
        createOrUpdateSteamUser(input),
      );
      if (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${error.message}`,
        });
      }
      return {
        steamId: steamUser.steamId,
        personaName: steamUser.personaName,
      };
    }),

  epicStatus: publicProcedure.query(async () => {
    const epicUser = await getEpicUser();
    if (!epicUser) return null;
    return {
      accountId: epicUser.accountId,
      displayName: epicUser.displayName,
    };
  }),

  epicAuth: publicProcedure
    .input(
      z.object({
        code: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { data: epicUser, error } = await tryCatch(
        createOrUpdateEpicUser(input.code),
      );
      if (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${error.message}`,
        });
      }
      return {
        accountId: epicUser.accountId,
        displayName: epicUser.displayName,
      };
    }),
});
