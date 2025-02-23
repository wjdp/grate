import { getUserGames } from '~/lib/steam/api';
import createErrorFromSteamApiError from '~/utils/createErrorFromSteamApiError';
export default defineEventHandler(async (event) => {
    try {
        return await getUserGames();
    } catch (error) {
        return createErrorFromSteamApiError(error);
    }
});
