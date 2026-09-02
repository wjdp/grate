import { faker } from "@faker-js/faker";
import type { SteamGame } from "~~/db/schema";
import {
  type CommunityProfile,
  type UserGame,
  userGameSchema,
} from "~~/lib/steam/api";

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
  return userGameSchema.parse({
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
  });
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
    appId: overrides.appId ?? faker.number.int({ min: 1, max: 2_000_000_000 }),
    name: overrides.name ?? faker.commerce.productName(),
  } as SteamGame);
}

export function generateFakeCommunityProfile(
  overrides: Partial<CommunityProfile> = {},
): CommunityProfile {
  return {
    steamID64: faker.string.numeric(17),
    steamID: faker.internet.username(),
    avatarIcon: faker.internet.url(),
    avatarMedium: faker.internet.url(),
    avatarFull: faker.internet.url(),
    realname: faker.person.fullName(),
    customURL: faker.internet.username(),
    ...filterUndefinedKeys(overrides),
  };
}
