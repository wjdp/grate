import { createOrUpdateEpicUser } from "~~/lib/epic/service";
import { epicAuthBodySchema } from "#shared/schemas/providers";
import tryCatch from "~~/utils/tryCatch";

export default defineEventHandler(async (event) => {
  const { code } = await readValidatedBody(event, epicAuthBodySchema.parse);
  const { data: epicUser, error } = await tryCatch(
    createOrUpdateEpicUser(code),
  );
  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: error.message,
    });
  }
  return {
    accountId: epicUser.accountId,
    displayName: epicUser.displayName,
  };
});
