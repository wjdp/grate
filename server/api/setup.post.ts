import {z} from "zod";
import { createErrorFromRequestValidation } from "~/utils/createErrorFromRequestValidation";
import * as steam from "~/lib/steam/api";
import createErrorFromSteamApiError from "~/utils/createErrorFromSteamApiError";
import prisma from "~/lib/prisma";

const requestSchema = z.object({});

export default defineEventHandler(async (event) => {
    let data: z.infer<typeof requestSchema>;
    try {
        const body = await readBody(event)
        data = requestSchema.parse(body);
    } catch (error) {
        throw createErrorFromRequestValidation(error);
    }
    let steamUser;
    try {
        steamUser = await steam.getUserInfo();
    } catch (error) {
        throw createErrorFromSteamApiError(error);
    }
    await prisma.user.create({
        data: {
            steamUser: {
                create : {
                    steamId: steamUser.steamid,
                    personaName: steamUser.personaname,
                    realName: steamUser.realname,
                    profileUrl: steamUser.profileurl,
                    avatar: steamUser.avatar,
                    avatarMedium: steamUser.avatarmedium,
                    avatarFull: steamUser.avatarfull,
                    avatarHash: steamUser.avatarhash,
                    lastLogoff: steamUser.lastlogoff,
                }
            }
        }
    })
    return {status: "ok"};
});
