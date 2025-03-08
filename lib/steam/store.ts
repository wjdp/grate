import { z } from "zod";

const SteamAppInfo = z.object({
  type: z.string(),
  name: z.string(),
  steam_appid: z.number(),
  required_age: z.number(),
  is_free: z.boolean(),
  detailed_description: z.string(),
  about_the_game: z.string(),
  short_description: z.string(),
  header_image: z.string(),
  capsule_image: z.string(),
  capsule_imagev5: z.string(),
  website: z.string(),
  developers: z.array(z.string()),
  publishers: z.array(z.string()),
  platforms: z.object({
    windows: z.boolean(),
    mac: z.boolean(),
    linux: z.boolean(),
  }),
  metacritic: z
    .object({
      score: z.number(),
      url: z.string(),
    })
    .nullable(),
  categories: z.array(
    z.object({
      id: z.number(),
      description: z.string(),
    }),
  ),
  genres: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
    }),
  ),
  screenshots: z.array(
    z.object({
      id: z.number(),
      path_thumbnail: z.string(),
      path_full: z.string(),
    }),
  ),
  release_date: z.object({
    coming_soon: z.boolean(),
    date: z.string(),
  }),
  background: z.string(),
  background_raw: z.string(),
});

export async function getAppDetails(appId: number) {
  const response = await fetch(
    `http://store.steampowered.com/api/appdetails/?appids=${appId}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch app details");
  }
  const data = await response.json();
  const appData = data[appId];
  if (!appData.success) {
    throw new Error("Failed to fetch app details");
  }
  return SteamAppInfo.parse(appData.data);
}
