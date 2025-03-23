import type { SteamGame, SteamGamePlaytime } from "@prisma/client";
import prisma from "../prisma";
import { getUserGames, getUserInfo, type UserGame } from "./api";
import { getAppDetails, parseReleaseDate, SteamStoreError } from "./store";

export class SteamServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SteamServiceError";
  }
}

export async function updateUser() {
  const currentUser = await prisma.steamUser.findFirst();
  if (!currentUser) {
    throw new Error("User not found");
  }
  const steamUser = await getUserInfo();
  const updateUser = await prisma.steamUser.update({
    where: { steamId: currentUser.steamId },
    data: {
      personaName: steamUser.personaname,
      realName: steamUser.realname,
      profileUrl: steamUser.profileurl,
      avatar: steamUser.avatar,
      avatarMedium: steamUser.avatarmedium,
      avatarFull: steamUser.avatarfull,
      avatarHash: steamUser.avatarhash,
      lastLogoff: steamUser.lastlogoff,
    },
  });
  console.log(`Updated user ${updateUser.personaName}`);
  return updateUser;
}

async function createGame(game: UserGame) {
  const newGame = await prisma.game.create({
    data: {
      name: game.name,
      steamGame: {
        create: {
          appId: game.appid,
          name: game.name,
          playtimeForever: game.playtime_forever,
          playtime2weeks: game.playtime_2weeks,
          playtimeWindowsForever: game.playtime_windows_forever,
          playtimeMacForever: game.playtime_mac_forever,
          playtimeLinuxForever: game.playtime_linux_forever,
          playtimeDeckForever: game.playtime_deck_forever,
          playtimeDisconnected: game.playtime_disconnected,
          rTimeLastPlayed: game.rtime_last_played,
          imgIconUrl: game.img_icon_url,
          capsuleFilename: game.capsule_filename,
          hasCommunityVisibleStats: game.has_community_visible_stats,
          hasWorkshop: game.has_workshop,
          hasDlc: game.has_dlc,
          hasLeaderboards: game.has_leaderboards,
        },
      },
    },
    include: { steamGame: true },
  });
  return newGame.steamGame as SteamGame;
}

async function updateGame(game: UserGame) {
  const updatedGame = await prisma.steamGame.update({
    where: { appId: game.appid },
    data: {
      name: game.name,
      playtimeForever: game.playtime_forever,
      playtime2weeks: game.playtime_2weeks,
      playtimeWindowsForever: game.playtime_windows_forever,
      playtimeMacForever: game.playtime_mac_forever,
      playtimeLinuxForever: game.playtime_linux_forever,
      playtimeDeckForever: game.playtime_deck_forever,
      playtimeDisconnected: game.playtime_disconnected,
      rTimeLastPlayed: game.rtime_last_played,
      imgIconUrl: game.img_icon_url,
      capsuleFilename: game.capsule_filename,
      hasCommunityVisibleStats: game.has_community_visible_stats,
      hasWorkshop: game.has_workshop,
      hasDlc: game.has_dlc,
      hasLeaderboards: game.has_leaderboards,
    },
  });
  return updatedGame;
}

async function updateOrCreateGame(game: UserGame) {
  // check if the game exists
  const existingGame = await prisma.steamGame.findFirst({
    where: { appId: game.appid },
  });
  if (existingGame) {
    const updatedGame = await updateGame(game);
    console.log(`Updated game ${updatedGame.name}`);
    return updatedGame;
  }
  const createdGame = await createGame(game);
  console.log(`Created game ${createdGame.name}`);
}

export async function updateGames() {
  const currentUser = await prisma.steamUser.findFirst();
  if (!currentUser) {
    throw new Error("User not found");
  }
  const games = await getUserGames();
  for (const game of games) {
    await updateOrCreateGame(game);
  }
  return games;
}

export async function findGamesNeedingStoreData(): Promise<SteamGame[]> {
  const games = await prisma.steamGame.findMany({
    where: {
      appInfoState: "NOT_FETCHED",
    },
  });
  return games;
}

export async function populateStoreData(appId: bigint): Promise<SteamGame> {
  const now = new Date();
  const game = await prisma.steamGame.findFirst({
    where: { appId },
  });
  if (!game) {
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
        const steamApp = await prisma.steamGame.update({
          where: { appId },
          data: { appInfoState: "UNAVAILABLE" },
        });
        return steamApp;
      }
    }
    throw new SteamServiceError(
      `Failed to fetch app details for ${appId}: ${error}`,
    );
  }
  const steamApp = await prisma.steamGame.update({
    where: { appId },
    data: {
      appInfoState: "FETCHED",
      appInfo: {
        create: {
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
          metacriticScore: storeAppInfo.metacritic?.score,
          metacriticUrl: storeAppInfo.metacritic?.url,
          categories: storeAppInfo.categories ?? [],
          genres: storeAppInfo.genres ?? [],
          screenshots: storeAppInfo.screenshots ?? [],
          releaseDate: storeAppInfo.release_date
            ? parseReleaseDate(storeAppInfo.release_date.date)
            : undefined,
          comingSoon: storeAppInfo.release_date?.coming_soon,
          background: storeAppInfo.background,
          backgroundRaw: storeAppInfo.background_raw,
        },
      },
    },
    include: { appInfo: true },
  });
  return steamApp;
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
    record1.playtime2weeks === record2.playtime_2weeks &&
    record1.playtimeWindowsForever === record2.playtime_windows_forever &&
    record1.playtimeMacForever === record2.playtime_mac_forever &&
    record1.playtimeLinuxForever === record2.playtime_linux_forever &&
    record1.playtimeDeckForever === record2.playtime_deck_forever &&
    record1.playtimeDisconnected === record2.playtime_disconnected
  );
}

export async function recordPlaytime(userGame: UserGame, now: Date) {
  const lastPlaytimeRecord = await prisma.steamGamePlaytime.findFirst({
    where: { steamAppId: userGame.appid },
    orderBy: { timestampEnd: "desc" },
  });
  const penultimatePlaytimeRecord = await prisma.steamGamePlaytime.findFirst({
    where: { steamAppId: userGame.appid },
    orderBy: { timestampEnd: "desc" },
    skip: 1,
  });
  if (
    lastPlaytimeRecord &&
    doesPlaytimeRecordMatchCurrentState(lastPlaytimeRecord, userGame) &&
    penultimatePlaytimeRecord &&
    doesPlaytimeRecordMatchCurrentState(penultimatePlaytimeRecord, userGame)
  ) {
    console.log(`No new playtime for ${userGame.name}`);
    // extend timestampEnd of the last record
    return await prisma.steamGamePlaytime.update({
      where: { id: lastPlaytimeRecord.id },
      data: { timestampEnd: now },
    });
  }
  const timestampStart = lastPlaytimeRecord
    ? lastPlaytimeRecord.timestampEnd
    : undefined;
  const record = await prisma.steamGamePlaytime.create({
    data: {
      steamGame: { connect: { appId: userGame.appid } },
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
    },
  });
  console.log(`Recorded playtime for ${userGame.name}`);
  return record;
}

export async function recordPlaytimes() {
  const steamGamesInDb = await prisma.steamGame.findMany();
  const userOwnedGames = await getUserGames();
  const timestampEnd = new Date();
  for (const userGame of userOwnedGames) {
    const dbGame = steamGamesInDb.find((g) => g.appId === userGame.appid);
    if (!dbGame) {
      throw new Error(`Game ${userGame.name} not found in db`);
    }
    await recordPlaytime(userGame, timestampEnd);
  }
}

export async function getPlaytimeRecords(appId: bigint) {
  return prisma.steamGamePlaytime.findMany({
    where: { steamAppId: appId },
  });
}
