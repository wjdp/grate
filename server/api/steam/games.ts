import { defineEventHandler } from 'h3';
import { getUserGames } from '~/lib/steam';
import createErrorFromSteamApiError from '~/utils/createErrorFromSteamApiError';
export default defineEventHandler(async (event) => {
    try {
        return await getUserGames();
    } catch (error) {
        return createErrorFromSteamApiError(error);
    }
});
