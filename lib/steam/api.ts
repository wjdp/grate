import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

export class SteamApiError extends Error {
  statusCode: number;

  constructor({
    message,
    statusCode,
  }: {
    message: string;
    statusCode: number;
  }) {
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
  const response = await fetch(
    `${BASE_URL}/ISteamWebAPIUtil/GetServerInfo/v1/`,
  );
  const data = await response.json();
  return serverInfoSchema.parse(data);
}

export interface SteamCredentials {
  accessToken: string;
  steamId: string;
}

const COMMUNITY_BASE_URL = "https://steamcommunity.com";

const communityProfileSchema = z.object({
  // 64-bit SteamID: keep it a string, it is never used arithmetically
  steamID64: z.string(),
  steamID: z.string(),
  avatarIcon: z.string(),
  avatarMedium: z.string(),
  avatarFull: z.string(),
  realname: z.string().nullish().transform(emptyToNull),
  customURL: z.string().nullish().transform(emptyToNull),
});

export type CommunityProfile = z.infer<typeof communityProfileSchema>;

function emptyToNull(value: string | null | undefined): string | null {
  return value ? value : null;
}

// parseTagValue keeps every value a string, so the 64-bit SteamID survives.
const xmlParser = new XMLParser({ parseTagValue: false, trimValues: true });

export async function getCommunityProfile(
  steamId: string,
): Promise<CommunityProfile> {
  const response = await fetch(
    `${COMMUNITY_BASE_URL}/profiles/${steamId}/?xml=1`,
  );
  if (!response.ok) {
    throw createSteamApiError(response);
  }
  const document = xmlParser.parse(await response.text());
  if (!document.profile) {
    throw new SteamApiError({
      message:
        typeof document.response?.error === "string"
          ? document.response.error
          : `Steam returned no profile for SteamID ${steamId}`,
      statusCode: 404,
    });
  }
  return communityProfileSchema.parse(document.profile);
}

export const userGameSchema = z.object({
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

export async function getUserGames({
  accessToken,
  steamId,
}: SteamCredentials): Promise<UserGame[]> {
  const parameters = new URLSearchParams({
    access_token: accessToken,
    steamid: steamId,
    include_appinfo: "1",
    include_played_free_games: "1",
    include_extended_appinfo: "1",
  });
  const response = await fetch(
    `${BASE_URL}/IPlayerService/GetOwnedGames/v1/?${parameters}`,
  );
  if (!response.ok) {
    throw createSteamApiError(response);
  }
  const data = await response.json();
  const gameCount = data.response.game_count;
  const games = z.array(userGameSchema).parse(data.response.games);
  if (games.length !== gameCount) {
    console.error("Game count mismatch");
  }
  return games;
}

const tagListSchema = z.object({
  response: z.object({
    tags: z.array(z.object({ tagid: z.number(), name: z.string() })),
  }),
});

export type SteamStoreTag = z.infer<
  typeof tagListSchema
>["response"]["tags"][number];

// Keyless: GetTagList takes no API key, only a language.
export async function getTagList(): Promise<SteamStoreTag[]> {
  const parameters = new URLSearchParams({ language: "english" });
  const response = await fetch(
    `${BASE_URL}/IStoreService/GetTagList/v1/?${parameters}`,
  );
  if (!response.ok) {
    throw createSteamApiError(response);
  }
  const data = await response.json();
  return tagListSchema.parse(data).response.tags;
}
