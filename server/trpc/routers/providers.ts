import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { createOrUpdateGogUser } from "~/lib/gog/service";
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
        steamId: z.string().regex(/^\d{17}$/),
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
});
