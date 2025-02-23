import { defineEventHandler } from 'h3';
import { getServerInfo } from '~/lib/steam';
export default defineEventHandler(async (event) => {
    return getServerInfo();
});
