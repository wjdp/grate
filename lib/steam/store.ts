import { z } from "zod";

export class SteamStoreError extends Error {
  retriable: boolean;
  constructor(message: string, retriable = false) {
    super(message);
    this.name = "SteamStoreError";
    this.retriable = retriable;
  }
}

const SteamAppInfo = z.object({
  type: z.string(),
  name: z.string(),
  steam_appid: z.number(),
  required_age: z.union([z.number(), z.string()]),
  is_free: z.boolean(),
  detailed_description: z.string(),
  about_the_game: z.string(),
  short_description: z.string(),
  header_image: z.string(),
  capsule_image: z.string(),
  capsule_imagev5: z.string(),
  website: z.string().nullable(),
  developers: z.array(z.string()),
  publishers: z.array(z.string()).optional(),
  platforms: z.object({
    windows: z.boolean(),
    mac: z.boolean(),
    linux: z.boolean(),
  }),
  metacritic: z
    .object({
      score: z.number(),
      url: z.string().optional(),
    })
    .optional(),
  categories: z
    .array(
      z.object({
        id: z.number(),
        description: z.string(),
      }),
    )
    .optional(),
  genres: z
    .array(
      z.object({
        id: z.string(),
        description: z.string(),
      }),
    )
    .optional(),
  screenshots: z
    .array(
      z.object({
        id: z.number(),
        path_thumbnail: z.string(),
        path_full: z.string(),
      }),
    )
    .optional(),
  release_date: z
    .object({
      coming_soon: z.boolean(),
      date: z.string(),
    })
    .optional(),
  background: z.string(),
  background_raw: z.string(),
});

export async function getAppDetails(appId: number) {
  const response = await fetch(
    `http://store.steampowered.com/api/appdetails/?appids=${appId}`,
  );
  if (!response.ok) {
    if (response.status === 429) {
      throw new SteamStoreError("Too many requests", true);
    }
    throw new SteamStoreError(response.statusText, true);
  }
  const data = await response.json();
  const appData = data[appId.toString()];
  if (!appData.success) {
    throw new SteamStoreError("App details unavailable", false);
  }
  return SteamAppInfo.parse(appData.data);
}

export function parseReleaseDate(s: string) {
  if (!s) {
    return null;
  }
  // date from steam is like: 25 Mar, 2013
  let date;
  try {
    date = new Date(s);
  } catch (error) {
    console.error(`Error parsing date: ${date}`);
    throw error;
  }
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }
  return date;
}
