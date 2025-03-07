import { ZodError } from "zod";
import createUnknownError from "./createUnknownError";

export function createErrorFromRequestValidation(error: any) {
  if (error instanceof ZodError) {
    return createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "The request did not match the expected schema",
      data: {
        errors: error.errors,
      },
    });
  }

  return createUnknownError(error);
}
