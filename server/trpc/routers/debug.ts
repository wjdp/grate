import { z } from "zod";
import { publicProcedure, router } from "../trpc";

export default router({
  hello: publicProcedure
    .input(
      z.object({
        text: z.string().nullish(),
      }),
    )
    .query(({ input }) => {
      const time = new Date().toLocaleTimeString();
      return {
        greeting: `hello ${input?.text ?? "world"}, the time is ${time}`,
      };
    }),
});
