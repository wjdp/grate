import { getUserInfo } from '~/lib/steam/api';
import createErrorFromSteamApiError from '~/utils/createErrorFromSteamApiError';
export default defineEventHandler(async (event) => {
    try {
        return await getUserInfo();
    } catch (error) {
        return createErrorFromSteamApiError(error);
    }
});
