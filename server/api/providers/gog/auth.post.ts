import { createOrUpdateGogUser } from "~~/lib/gog/service";
import { gogAuthBodySchema } from "#shared/schemas/providers";
import tryCatch from "~~/utils/tryCatch";

export default defineEventHandler(async (event) => {
  const { code } = await readValidatedBody(event, gogAuthBodySchema.parse);
  const { data: token, error } = await tryCatch(createOrUpdateGogUser(code));
  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: error.message,
    });
  }
  return { token };
});
