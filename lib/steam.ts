import { z } from "zod";

export class SteamApiError extends Error {
    statusCode: number;

    constructor({ message, statusCode }: { message: string, statusCode: number }) {
        super(message);
        this.name = "SteamApiError";
        this.statusCode = statusCode;
    }
}

function createSteamApiError(response: Response): SteamApiError {
    return new SteamApiError({
        message: response.statusText,
        statusCode: response.status,
    });
}

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
    // steamid is string from server but we want it as number
    steamid: z.string().transform(Number),
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
    if (!response.ok) {
        throw createSteamApiError(response);
    }
    const data = await response.json();
    return userInfoSchema.parse(data.response.players[0]);
}

const userGameSchema = z.object({
    appid: z.number(),
    name: z.string(),

    playtime_forever: z.number().optional(),
    playtime_2weeks: z.number().optional(),
    playtime_windows_forever: z.number().optional(),
    playtime_mac_forever: z.number().optional(),
    playtime_linux_forever: z.number().optional(),
    playtime_deck_forever: z.number().optional(),
    playtime_disconnected: z.number().optional(),
    rtime_last_played: z.number().optional(),

    // img_icon_url, img_logo_url - these are the filenames of various images for the
    // game. To construct the URL to the image, use this format:
    // http://media.steampowered.com/steamcommunity/public/images/apps/{appid}/{hash}.jpg.
    // For example, the TF2 logo is returned as "07385eb55b5ba974aebbe74d3c99626bda7920b8",
    // which maps to the URL: [1]
    img_icon_url: z.string(),
    capsule_filename: z.string(),

    // indicates there is a stats page with achievements or other game stats available
    // for this game. The uniform URL for accessing this data is
    // http://steamcommunity.com/profiles/{steamid}/stats/{appid}.
    // For example, Robin's TF2 stats can be found at:
    // http://steamcommunity.com/profiles/76561197960435530/stats/440.
    // You may notice that clicking this link will actually redirect to a vanity URL like
    // /id/robinwalker/stats/TF2
    has_community_visible_stats: z.boolean().optional(),

    has_workshop: z.boolean().optional(),
    has_market: z.boolean().optional(),
    has_dlc: z.boolean().optional(),
    has_leaderboards: z.boolean().optional(),
});

export type UserGame = z.infer<typeof userGameSchema>;

export async function getUserGames(): Promise<UserGame[]> {
    // @ts-ignore
    const parameters = new URLSearchParams({
        key: process.env.STEAM_API_KEY,
        steamid: process.env.STEAM_USER_ID,
        include_appinfo: "1",
        include_played_free_games: "1",
        include_extended_appinfo: "1",
    });
    const response = await fetch(`${BASE_URL}/IPlayerService/GetOwnedGames/v1/?` + parameters.toString());
    if (!response.ok) {
        throw createSteamApiError(response);
    }
    const data = await response.json();
    const gameCount = data.response.game_count;
    const rawGames = data.response.games;
    const games = rawGames.map((game: any) => userGameSchema.parse(game));
    if (games.length !== gameCount) {
        console.error("Game count mismatch");
    }
    return games;
}
