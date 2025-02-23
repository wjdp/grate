import {z} from "zod";

const BASE_URL = "https://api.steampowered.com";

const serverInfoSchema = z.object({
    servertime: z.number(),
    servertimestring: z.string(),
});

export type ServerInfo = z.infer<typeof serverInfoSchema>;

export async function getServerInfo(): Promise<ServerInfo> {
    const response = await fetch(`${BASE_URL}/ISteamWebAPIUtil/GetServerInfo/v1/`);
    const data = await response.json();
    return serverInfoSchema.parse(data);
}

const userInfoSchema = z.object({
    steamid: z.string(),
    personaname: z.string(),
    profileurl: z.string(),
    communityvisibilitystate: z.number(),
    profilestate: z.number(),
    avatar: z.string(),
    avatarmedium: z.string(),
    avatarfull: z.string(),
    avatarhash: z.string(),
    lastlogoff: z.number(),
    personastate: z.number(),
    realname: z.string().nullable(),
    primaryclanid: z.string().nullable(),
    timecreated: z.number(),
    personastateflags: z.number(),
    loccountrycode: z.string().nullable(),
    locstatecode: z.string().nullable(),
});

export type UserInfo = z.infer<typeof userInfoSchema>;

export async function getUserInfo(): Promise<UserInfo> {
    const response = await fetch(`${BASE_URL}/ISteamUser/GetPlayerSummaries/v2/?key=${process.env.STEAM_API_KEY}&steamids=${process.env.STEAM_USER_ID}`);
    const data = await response.json();
    return userInfoSchema.parse(data.response.players[0]);
}
