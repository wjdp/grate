import { desc, eq } from "drizzle-orm";
import { db } from "~~/lib/db";
import {
  game,
  steamAppInfo,
  steamGame,
  steamGamePlaytime,
  steamUser,
  user,
  type NewSteamAppInfo,
  type SteamGame,
  type SteamGamePlaytime,
  type SteamUser,
} from "~~/db/schema";
import { refreshGameAggregates } from "~/lib/gameAggregates";
import {
  getUserGames,
  getUserInfo,
  resolveVanityUrl,
  type SteamCredentials,
  type UserGame,
  type UserInfo,
} from "./api";
import { parseSteamProfileInput } from "~~/shared/steam-profile";
import { getAppDetails, parseReleaseDate, SteamStoreError } from "./store";

export class SteamServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SteamServiceError";
  }
}

export async function getSteamUser(): Promise<SteamUser | null> {
  return (await db.query.steamUser.findFirst()) ?? null;
}

export function steamCredentialsOf(steamUserRow: SteamUser): SteamCredentials {
  if (!steamUserRow.apiKey) {
    throw new SteamServiceError("Steam API key not configured");
  }
  return { apiKey: steamUserRow.apiKey, steamId: steamUserRow.steamId };
}

function steamUserProfileFields(steamUserInfo: UserInfo) {
  return {
    personaName: steamUserInfo.personaname,
    realName: steamUserInfo.realname,
    profileUrl: steamUserInfo.profileurl,
    avatar: steamUserInfo.avatar,
    avatarMedium: steamUserInfo.avatarmedium,
    avatarFull: steamUserInfo.avatarfull,
    avatarHash: steamUserInfo.avatarhash,
    lastLogoff: steamUserInfo.lastlogoff,
  };
}

export async function resolveSteamId(
  apiKey: string,
  profileInput: string,
): Promise<string> {
  const parsed = parseSteamProfileInput(profileInput);
  if (!parsed) {
    throw new SteamServiceError(
      "Enter a Steam profile URL, vanity name or SteamID64",
    );
  }
  if ("steamId" in parsed) {
    return parsed.steamId;
  }
  return resolveVanityUrl(apiKey, parsed.vanityName);
}

export interface SteamProfileCredentials {
  apiKey: string;
  profile: string;
}

export async function createOrUpdateSteamUser({
  apiKey,
  profile,
}: SteamProfileCredentials): Promise<SteamUser> {
  const steamId = await resolveSteamId(apiKey, profile);
  const steamUserInfo = await getUserInfo({ apiKey, steamId });
  const currentUser = await getSteamUser();
  if (currentUser && currentUser.steamId !== steamUserInfo.steamid) {
    throw new SteamServiceError("grate only supports a single Steam account");
  }
  const profileFields = steamUserProfileFields(steamUserInfo);
  return db.transaction((tx) => {
    const owner =
      tx.select().from(user).limit(1).get() ??
      tx.insert(user).values({}).returning().get();
    return tx
      .insert(steamUser)
      .values({
        steamId: steamUserInfo.steamid,
        userId: owner.id,
        apiKey,
        ...profileFields,
      })
      .onConflictDoUpdate({
        target: steamUser.steamId,
        set: { apiKey, ...profileFields },
      })
      .returning()
      .get();
  });
}

export async function updateUser() {
  const currentUser = await getSteamUser();
  if (!currentUser) {
    throw new Error("User not found");
  }
  const steamUserInfo = await getUserInfo(steamCredentialsOf(currentUser));
  const updateUser = db
    .update(steamUser)
    .set(steamUserProfileFields(steamUserInfo))
    .where(eq(steamUser.steamId, currentUser.steamId))
    .returning()
    .get();
  console.log(`Updated user ${updateUser.personaName}`);
  return updateUser;
}

async function createGame(userGame: UserGame): Promise<SteamGame> {
  return db.transaction((tx) => {
    const newGame = tx
      .insert(game)
      .values({ name: userGame.name })
      .returning()
      .get();
    return tx
      .insert(steamGame)
      .values({
        gameId: newGame.id,
        appId: userGame.appid,
        name: userGame.name,
        playtimeForever: userGame.playtime_forever,
        playtime2weeks: userGame.playtime_2weeks,
        playtimeWindowsForever: userGame.playtime_windows_forever,
        playtimeMacForever: userGame.playtime_mac_forever,
        playtimeLinuxForever: userGame.playtime_linux_forever,
        playtimeDeckForever: userGame.playtime_deck_forever,
        playtimeDisconnected: userGame.playtime_disconnected,
        rTimeLastPlayed: userGame.rtime_last_played,
        imgIconUrl: userGame.img_icon_url,
        capsuleFilename: userGame.capsule_filename,
        hasCommunityVisibleStats: userGame.has_community_visible_stats,
        hasWorkshop: userGame.has_workshop,
        hasDlc: userGame.has_dlc,
        hasLeaderboards: userGame.has_leaderboards,
      })
      .returning()
      .get();
  });
}

async function updateGame(userGame: UserGame): Promise<SteamGame> {
  return db.transaction((tx) => {
    const updatedGame = tx
      .update(steamGame)
      .set({
        name: userGame.name,
        playtimeForever: userGame.playtime_forever,
        playtime2weeks: userGame.playtime_2weeks,
        playtimeWindowsForever: userGame.playtime_windows_forever,
        playtimeMacForever: userGame.playtime_mac_forever,
        playtimeLinuxForever: userGame.playtime_linux_forever,
        playtimeDeckForever: userGame.playtime_deck_forever,
        playtimeDisconnected: userGame.playtime_disconnected,
        rTimeLastPlayed: userGame.rtime_last_played,
        imgIconUrl: userGame.img_icon_url,
        capsuleFilename: userGame.capsule_filename,
        hasCommunityVisibleStats: userGame.has_community_visible_stats,
        hasWorkshop: userGame.has_workshop,
        hasDlc: userGame.has_dlc,
        hasLeaderboards: userGame.has_leaderboards,
      })
      .where(eq(steamGame.appId, userGame.appid))
      .returning()
      .get();
    tx.update(game)
      .set({ name: userGame.name })
      .where(eq(game.id, updatedGame.gameId))
      .run();
    return updatedGame;
  });
}

async function updateOrCreateGame(userGame: UserGame) {
  // check if the game exists
  const existingGame = db
    .select()
    .from(steamGame)
    .where(eq(steamGame.appId, userGame.appid))
    .limit(1)
    .get();
  let updatedGame: SteamGame;
  if (existingGame) {
    updatedGame = await updateGame(userGame);
    console.log(`Updated game ${updatedGame.name}`);
  } else {
    updatedGame = await createGame(userGame);
    console.log(`Created game ${updatedGame.name}`);
  }
  await refreshGameAggregates(updatedGame.gameId);
  return updatedGame;
}

export async function updateGames() {
  const currentUser = await getSteamUser();
  if (!currentUser) {
    throw new Error("User not found");
  }
  const games = await getUserGames(steamCredentialsOf(currentUser));
  for (const userGame of games) {
    await updateOrCreateGame(userGame);
  }
  return games;
}

export async function findGamesNeedingStoreData(): Promise<SteamGame[]> {
  return db
    .select()
    .from(steamGame)
    .where(eq(steamGame.appInfoState, "NOT_FETCHED"))
    .all();
}

export async function populateStoreData(appId: number): Promise<SteamGame> {
  const now = new Date();
  const existingGame = db
    .select()
    .from(steamGame)
    .where(eq(steamGame.appId, appId))
    .limit(1)
    .get();
  if (!existingGame) {
    throw new SteamServiceError(`Game ${appId} not in database`);
  }
  let storeAppInfo;
  try {
    storeAppInfo = await getAppDetails(appId);
  } catch (error) {
    if (error instanceof SteamStoreError) {
      if (!error.retriable) {
        // Handle non-retriable errors
        // This will be when the app is no longer available on the store so we cannot fetch its details
        return db
          .update(steamGame)
          .set({ appInfoState: "UNAVAILABLE" })
          .where(eq(steamGame.appId, appId))
          .returning()
          .get();
      }
    }
    throw new SteamServiceError(
      `Failed to fetch app details for ${appId}: ${error}`,
    );
  }
  const appInfoValues: NewSteamAppInfo = {
    appId,
    fetchedAt: now,
    type: storeAppInfo.type,
    name: storeAppInfo.name,
    requiredAge:
      typeof storeAppInfo.required_age === "number"
        ? storeAppInfo.required_age
        : parseInt(storeAppInfo.required_age),
    isFree: storeAppInfo.is_free,
    detailedDescription: storeAppInfo.detailed_description,
    aboutTheGame: storeAppInfo.about_the_game,
    shortDescription: storeAppInfo.short_description,
    headerImage: storeAppInfo.header_image,
    capsuleImage: storeAppInfo.capsule_image,
    capsuleImagev5: storeAppInfo.capsule_imagev5,
    website: storeAppInfo.website,
    developers: storeAppInfo.developers,
    publishers: storeAppInfo.publishers ?? [],
    platformWindows: storeAppInfo.platforms.windows,
    platformMac: storeAppInfo.platforms.mac,
    platformLinux: storeAppInfo.platforms.linux,
    metacriticScore: storeAppInfo.metacritic?.score ?? null,
    metacriticUrl: storeAppInfo.metacritic?.url ?? null,
    categories: storeAppInfo.categories ?? [],
    genres: storeAppInfo.genres ?? [],
    screenshots: storeAppInfo.screenshots ?? [],
    releaseDate: storeAppInfo.release_date
      ? parseReleaseDate(storeAppInfo.release_date.date)
      : null,
    comingSoon: storeAppInfo.release_date?.coming_soon ?? null,
    background: storeAppInfo.background,
    backgroundRaw: storeAppInfo.background_raw,
  };
  return db.transaction((tx) => {
    tx.insert(steamAppInfo).values(appInfoValues).run();
    return tx
      .update(steamGame)
      .set({ appInfoState: "FETCHED" })
      .where(eq(steamGame.appId, appId))
      .returning()
      .get();
  });
}

// This function is used to compare a playtime record in the database
// with the current state from the steam API. It returns true if all playtime
// fields match, false otherwise.
function doesPlaytimeRecordMatchCurrentState(
  record1: SteamGamePlaytime,
  record2: UserGame,
): boolean {
  return (
    record1.playtimeForever === record2.playtime_forever &&
    record1.playtimeWindowsForever === record2.playtime_windows_forever &&
    record1.playtimeMacForever === record2.playtime_mac_forever &&
    record1.playtimeLinuxForever === record2.playtime_linux_forever &&
    record1.playtimeDeckForever === record2.playtime_deck_forever &&
    record1.playtimeDisconnected === record2.playtime_disconnected
  );
}

export async function recordPlaytime(userGame: UserGame, now: Date) {
  const [lastPlaytimeRecord, penultimatePlaytimeRecord] = db
    .select()
    .from(steamGamePlaytime)
    .where(eq(steamGamePlaytime.steamAppId, userGame.appid))
    .orderBy(desc(steamGamePlaytime.timestampEnd))
    .limit(2)
    .all();
  if (
    lastPlaytimeRecord &&
    doesPlaytimeRecordMatchCurrentState(lastPlaytimeRecord, userGame) &&
    penultimatePlaytimeRecord &&
    doesPlaytimeRecordMatchCurrentState(penultimatePlaytimeRecord, userGame)
  ) {
    console.log(`No new playtime for ${userGame.name}`);
    // extend timestampEnd of the last record
    return db
      .update(steamGamePlaytime)
      .set({ timestampEnd: now })
      .where(eq(steamGamePlaytime.id, lastPlaytimeRecord.id))
      .returning()
      .get();
  }
  const timestampStart = lastPlaytimeRecord
    ? lastPlaytimeRecord.timestampEnd
    : null;
  const record = db
    .insert(steamGamePlaytime)
    .values({
      steamAppId: userGame.appid,
      timestampStart,
      timestampEnd: now,
      playtimeForever: userGame.playtime_forever,
      playtime2weeks: userGame.playtime_2weeks,
      playtimeWindowsForever: userGame.playtime_windows_forever,
      playtimeMacForever: userGame.playtime_mac_forever,
      playtimeLinuxForever: userGame.playtime_linux_forever,
      playtimeDeckForever: userGame.playtime_deck_forever,
      playtimeDisconnected: userGame.playtime_disconnected,
      rTimeLastPlayed: userGame.rtime_last_played,
    })
    .returning()
    .get();
  console.log(`Recorded playtime for ${userGame.name}`);
  return record;
}

export async function recordPlaytimes() {
  const currentUser = await getSteamUser();
  if (!currentUser) {
    throw new Error("User not found");
  }
  const steamGamesInDb = db.select().from(steamGame).all();
  const userOwnedGames = await getUserGames(steamCredentialsOf(currentUser));
  const timestampEnd = new Date();
  for (const userGame of userOwnedGames) {
    const dbGame = steamGamesInDb.find((g) => g.appId === userGame.appid);
    if (!dbGame) {
      throw new Error(`Game ${userGame.name} not found in db`);
    }
    await recordPlaytime(userGame, timestampEnd);
  }
}

export async function getPlaytimeRecords(appId: number) {
  return db
    .select()
    .from(steamGamePlaytime)
    .where(eq(steamGamePlaytime.steamAppId, appId))
    .all();
}
