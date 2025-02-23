import { ZodError } from "zod";
import { SteamApiError } from "~/lib/steam";
import createUnknownError from "./createUnknownError";

export default function createErrorFromSteamApiError(error: any): any {
    if (error instanceof SteamApiError) {
        return {
            statusCode: 500,
            statusMessage: "Steam API Error",
            message: error.message,
            data: {
                statusCode: error.statusCode,
                message: error.message,
            }
        };
    }

    if (error instanceof ZodError) {
        return {
            statusCode: 500,
            statusMessage: "Steam API Response Validation Error",
            message: "The Steam API returned a response that did not match the expected schema",
            data: {
                errors: error.errors,
            }
        };
    }

    return createUnknownError(error);
}
