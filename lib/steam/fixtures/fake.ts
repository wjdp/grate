import type { UserGame, UserInfo } from "~/lib/steam/api";
import { faker } from "@faker-js/faker";
import type { Game, SteamGame, SteamUser } from "@prisma/client";
import prisma from "~/lib/prisma";

function generateRTimeLastPlayed() {
  return faker.number.int({
    min: 0,
    max: Math.floor(Date.now() / 1000),
  });
}

function filterUndefinedKeys<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(o).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export async function createGame(overrides: Partial<Game> = {}): Promise<Game> {
  return prisma.game.create({
    data: {
      ...{
        name: faker.commerce.productName(),
      },
      ...filterUndefinedKeys(overrides),
    },
  });
}

export async function createSteamGame(
  overrides: Partial<SteamGame> = {},
): Promise<SteamGame> {
  const game = await createGame({ name: overrides.name });
  const appId = faker.number.bigInt();
  return prisma.steamGame.create({
    data: {
      ...{
        gameId: game.id,
        appId,
        name: game.name,
        playtimeForever: faker.number.int({ min: 0, max: 10000 }),
        playtime2weeks: faker.number.int({ min: 0, max: 1000 }),
        playtimeWindowsForever: faker.number.int({ min: 0, max: 10000 }),
        playtimeMacForever: faker.number.int({ min: 0, max: 10000 }),
        playtimeLinuxForever: faker.number.int({ min: 0, max: 10000 }),
        playtimeDeckForever: faker.number.int({ min: 0, max: 10000 }),
        playtimeDisconnected: faker.number.int({ min: 0, max: 10000 }),
        rTimeLastPlayed: generateRTimeLastPlayed(),
        imgIconUrl: faker.internet.url(),
        capsuleFilename: faker.system.fileName(),
        hasCommunityVisibleStats: faker.datatype.boolean(),
        hasWorkshop: faker.datatype.boolean(),
        hasDlc: faker.datatype.boolean(),
        hasLeaderboards: faker.datatype.boolean(),
      },
      ...overrides,
    },
    include: { game: true },
  });
}

export interface FakeUserGameOverrides {
  playtime_forever?: number;
  playtime_2weeks?: number;
  playtime_windows_forever?: number;
  playtime_mac_forever?: number;
  playtime_linux_forever?: number;
  playtime_deck_forever?: number;
  playtime_disconnected?: number;
}

export function generateFakeUserGame(
  steamGame: SteamGame,
  overrides?: FakeUserGameOverrides,
): UserGame {
  const playtime_forever =
    overrides?.playtime_forever ?? faker.number.int({ min: 0, max: 10000 });
  const playtime_2weeks =
    overrides?.playtime_2weeks ??
    Math.min(playtime_forever, faker.number.int({ min: 0, max: 1000 }));
  return {
    appid: steamGame.appId,
    name: steamGame.name,
    playtime_forever,
    playtime_2weeks,
    playtime_windows_forever: overrides?.playtime_windows_forever ?? 0,
    playtime_mac_forever: overrides?.playtime_mac_forever ?? 0,
    playtime_linux_forever: playtime_forever,
    playtime_deck_forever: playtime_forever,
    playtime_disconnected: overrides?.playtime_disconnected ?? 0,
    rtime_last_played: generateRTimeLastPlayed(),
    img_icon_url: faker.internet.url(),
    capsule_filename: faker.system.fileName(),
    has_community_visible_stats: faker.datatype.boolean(),
    has_workshop: faker.datatype.boolean(),
    has_market: faker.datatype.boolean(),
    has_dlc: faker.datatype.boolean(),
    has_leaderboards: faker.datatype.boolean(),
  };
}

export function mergeFake<T extends object>(
  original: T,
  update: Partial<T>,
): T {
  return { ...original, ...update };
}

export function generateUnownedFakeUserGame(
  overrides: Partial<Pick<SteamGame, "appId" | "name">> = {},
): UserGame {
  return generateFakeUserGame({
    appId: overrides.appId ?? faker.number.bigInt(),
    name: overrides.name ?? faker.commerce.productName(),
  } as SteamGame);
}

export async function createSteamUser(
  overrides: Partial<SteamUser> = {},
): Promise<SteamUser> {
  const user = await prisma.user.create({ data: {} });
  return prisma.steamUser.create({
    data: {
      ...{
        steamId: faker.number.bigInt(),
        userId: user.id,
        personaName: faker.internet.username(),
        realName: faker.person.fullName(),
        profileUrl: faker.internet.url(),
        avatar: faker.internet.url(),
        avatarMedium: faker.internet.url(),
        avatarFull: faker.internet.url(),
        avatarHash: faker.string.alphanumeric(40),
        lastLogoff: faker.number.int({ min: 0, max: 2_000_000_000 }),
      },
      ...overrides,
    },
  });
}

export function generateFakeUserInfo(
  overrides: Partial<UserInfo> = {},
): UserInfo {
  return {
    ...{
      steamid: faker.number.int({ min: 1, max: 2_000_000_000 }),
      personaname: faker.internet.username(),
      profileurl: faker.internet.url(),
      communityvisibilitystate: 3,
      profilestate: 1,
      avatar: faker.internet.url(),
      avatarmedium: faker.internet.url(),
      avatarfull: faker.internet.url(),
      avatarhash: faker.string.alphanumeric(40),
      lastlogoff: faker.number.int({ min: 0, max: 2_000_000_000 }),
      personastate: 1,
      realname: faker.person.fullName(),
      primaryclanid: null,
      timecreated: faker.number.int({ min: 0, max: 2_000_000_000 }),
      personastateflags: 0,
      loccountrycode: "GB",
      locstatecode: null,
    },
    ...filterUndefinedKeys(overrides),
  };
}
