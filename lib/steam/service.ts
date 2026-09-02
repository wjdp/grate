import { desc, eq } from "drizzle-orm";
import { refreshGameAggregates } from "~~/lib/gameAggregates";
import { countProviderRows } from "~~/lib/gameProviders";
import type { OnProgress, RecordPlaytimesResult } from "~~/lib/providerJobs";
import { db } from "~~/server/database/client";
import {
  game,
  type NewSteamAppInfo,
  type SteamGame,
  type SteamGamePlaytime,
  type SteamUser,
  steamAppInfo,
  steamGame,
  steamGamePlaytime,
  steamUser,
  user,
} from "~~/server/database/schema";
import {
  type CommunityProfile,
  getCommunityProfile,
  getUserGames,
  type SteamCredentials,
  type UserGame,
} from "./api";
import {
  getAppDetails,
  parseReleaseDate,
  type SteamStoreAppInfo,
  SteamStoreError,
} from "./store";
import {
  clearAccessTokenCache,
  getAccessToken,
  tryRenewRefreshToken,
} from "./webSession";

export class SteamServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SteamServiceError";
  }
}

export async function getSteamUser(): Promise<SteamUser | null> {
  return (await db.query.steamUser.findFirst()) ?? null;
}

export async function steamCredentials(): Promise<SteamCredentials> {
  const currentUser = await getSteamUser();
  const accessToken = await getAccessToken();
  if (!currentUser || !accessToken) {
    throw new SteamServiceError("Steam account not connected");
  }
  return { accessToken, steamId: currentUser.steamId };
}

function profileFieldsOf(profile: CommunityProfile) {
  return {
    personaName: profile.steamID,
    realName: profile.realname,
    profileUrl: profile.customURL
      ? `https://steamcommunity.com/id/${profile.customURL}`
      : `https://steamcommunity.com/profiles/${profile.steamID64}`,
    avatar: profile.avatarIcon,
    avatarMedium: profile.avatarMedium,
    avatarFull: profile.avatarFull,
  };
}

export interface SteamSessionLink {
  steamId: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export async function linkSteamAccount({
  steamId,
  refreshToken,
  refreshTokenExpiresAt,
}: SteamSessionLink): Promise<SteamUser> {
  const currentUser = await getSteamUser();
  if (currentUser && currentUser.steamId !== steamId) {
    throw new SteamServiceError(
      `grate only supports a single Steam account (linked: ${currentUser.steamId}, scanned: ${steamId})`,
    );
  }
  const profileFields = profileFieldsOf(await getCommunityProfile(steamId));
  const linkedUser = db.transaction((tx) => {
    const owner =
      tx.select().from(user).limit(1).get() ??
      tx.insert(user).values({}).returning().get();
    return tx
      .insert(steamUser)
      .values({
        steamId,
        userId: owner.id,
        refreshToken,
        refreshTokenExpiresAt,
        ...profileFields,
      })
      .onConflictDoUpdate({
        target: steamUser.steamId,
        set: { refreshToken, refreshTokenExpiresAt, ...profileFields },
      })
      .returning()
      .get();
  });
  clearAccessTokenCache();
  return linkedUser;
}

export async function unlinkSteamAccount(): Promise<void> {
  db.update(steamUser)
    .set({ refreshToken: null, refreshTokenExpiresAt: null })
    .run();
  clearAccessTokenCache();
}

export async function updateUser() {
  const currentUser = await getSteamUser();
  if (!currentUser) {
    throw new Error("User not found");
  }
  await tryRenewRefreshToken();
  const profile = await getCommunityProfile(currentUser.steamId);
  const updateUser = db
    .update(steamUser)
    .set(profileFieldsOf(profile))
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
    if (countProviderRows(updatedGame.gameId, tx) === 1) {
      tx.update(game)
        .set({ name: userGame.name })
        .where(eq(game.id, updatedGame.gameId))
        .run();
    }
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

const UPDATE_GAMES_PROGRESS_INTERVAL = 25;

export async function updateGames(onProgress?: OnProgress) {
  const currentUser = await getSteamUser();
  if (!currentUser) {
    throw new Error("User not found");
  }
  await tryRenewRefreshToken();
  const games = await getUserGames(await steamCredentials());
  await onProgress?.({ fraction: 0, message: `fetched ${games.length} games` });
  for (const [index, userGame] of games.entries()) {
    await updateOrCreateGame(userGame);
    const updatedCount = index + 1;
    if (
      updatedCount % UPDATE_GAMES_PROGRESS_INTERVAL === 0 &&
      updatedCount !== games.length
    ) {
      await onProgress?.({
        fraction: updatedCount / games.length,
        message: `updated ${updatedCount}/${games.length} games`,
      });
    }
  }
  await onProgress?.({
    fraction: 1,
    message: `updated ${games.length} games`,
  });
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
  let storeAppInfo: SteamStoreAppInfo;
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
        : parseInt(storeAppInfo.required_age, 10),
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

function steamLastPlayedAt(userGame: UserGame): Date | null {
  return userGame.rtime_last_played
    ? new Date(userGame.rtime_last_played * 1000)
    : null;
}

export async function recordPlaytime(userGame: UserGame, now: Date) {
  const [lastPlaytimeRecord, penultimatePlaytimeRecord] = db
    .select()
    .from(steamGamePlaytime)
    .where(eq(steamGamePlaytime.steamAppId, userGame.appid))
    .orderBy(desc(steamGamePlaytime.timestampEnd))
    .limit(2)
    .all();
  const lastPlayedAt = steamLastPlayedAt(userGame);
  if (!lastPlaytimeRecord && lastPlayedAt && lastPlayedAt < now) {
    const values = {
      steamAppId: userGame.appid,
      playtimeForever: userGame.playtime_forever,
      playtime2weeks: userGame.playtime_2weeks,
      playtimeWindowsForever: userGame.playtime_windows_forever,
      playtimeMacForever: userGame.playtime_mac_forever,
      playtimeLinuxForever: userGame.playtime_linux_forever,
      playtimeDeckForever: userGame.playtime_deck_forever,
      playtimeDisconnected: userGame.playtime_disconnected,
      rTimeLastPlayed: userGame.rtime_last_played,
    };
    db.insert(steamGamePlaytime)
      .values({ ...values, timestampStart: null, timestampEnd: lastPlayedAt })
      .run();
    const groundedRecord = db
      .insert(steamGamePlaytime)
      .values({ ...values, timestampStart: lastPlayedAt, timestampEnd: now })
      .returning()
      .get();
    console.log(
      `Recorded initial playtime for ${userGame.name} grounded on its last session`,
    );
    return groundedRecord;
  }
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

export async function recordPlaytimes(
  onProgress?: OnProgress,
): Promise<RecordPlaytimesResult> {
  const currentUser = await getSteamUser();
  if (!currentUser) {
    throw new Error("User not found");
  }
  const knownAppIds = new Set(
    db
      .select({ appId: steamGame.appId })
      .from(steamGame)
      .all()
      .map((row) => row.appId),
  );
  await tryRenewRefreshToken();
  const userOwnedGames = await getUserGames(await steamCredentials());
  await onProgress?.({
    fraction: 0,
    message: `fetched ${userOwnedGames.length} owned games`,
  });
  const timestampEnd = new Date();
  let gamesCreated = 0;
  for (const userGame of userOwnedGames) {
    if (!knownAppIds.has(userGame.appid)) {
      await updateOrCreateGame(userGame);
      knownAppIds.add(userGame.appid);
      gamesCreated++;
    }
    await recordPlaytime(userGame, timestampEnd);
  }
  await onProgress?.({
    fraction: 1,
    message: `recorded playtime for ${userOwnedGames.length} games, created ${gamesCreated}`,
  });
  return { gamesCreated, unknownGames: 0 };
}

export async function getPlaytimeRecords(appId: number) {
  return db
    .select()
    .from(steamGamePlaytime)
    .where(eq(steamGamePlaytime.steamAppId, appId))
    .all();
}
