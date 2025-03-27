import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { getGogToken } from "~/lib/gog/api";
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
      const { data: token, error } = await tryCatch(getGogToken(input.code));
      if (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to authenticate with GOG",
        });
      }
      return { token };
    }),
});
