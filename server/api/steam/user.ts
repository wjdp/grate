import { defineEventHandler } from 'h3';
import { getUserInfo, SteamApiError } from '~/lib/steam';
import createErrorFromSteamApiError from '~/utils/createErrorFromSteamApiError';
export default defineEventHandler(async (event) => {
    try {
        return await getUserInfo();
    } catch (error) {
        return createErrorFromSteamApiError(error);
    }
});
