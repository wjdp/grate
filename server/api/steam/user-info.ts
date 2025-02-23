import { defineEventHandler } from 'h3';
import { getUserInfo } from '~/lib/steam';
export default defineEventHandler(async (event) => {
    return await getUserInfo();
});
