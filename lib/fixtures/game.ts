import { faker } from "@faker-js/faker";
import {
  type EpicGame,
  epicGame,
  type Game,
  type GameDistinctPair,
  type GogGame,
  game,
  gameDistinctPair,
  gogGame,
  type NewEpicGame,
  type NewGame,
  type NewGogGame,
  type NewSteamGame,
  type NewSteamUser,
  type SteamGame,
  type SteamUser,
  steamGame,
  steamUser,
  user,
} from "~~/db/schema";
import { db } from "~~/lib/db";

export function createGame(overrides: Partial<NewGame> = {}): Game {
  return db
    .insert(game)
    .values({
      ...overrides,
      name: overrides.name ?? faker.commerce.productName(),
    })
    .returning()
    .get();
}

export function createGameDistinctPair(
  gameAId: number,
  gameBId: number,
): GameDistinctPair {
  return db
    .insert(gameDistinctPair)
    .values({
      gameAId: Math.min(gameAId, gameBId),
      gameBId: Math.max(gameAId, gameBId),
    })
    .returning()
    .get();
}

export function createSteamGame(
  overrides: Partial<NewSteamGame> = {},
): SteamGame {
  const gameId = overrides.gameId ?? createGame({ name: overrides.name }).id;
  const name = overrides.name ?? faker.commerce.productName();
  return db
    .insert(steamGame)
    .values({
      gameId,
      name,
      appId: faker.number.int({ min: 1, max: 2_000_000_000 }),
      playtimeForever: faker.number.int({ min: 0, max: 10_000 }),
      playtime2weeks: faker.number.int({ min: 0, max: 1000 }),
      playtimeWindowsForever: faker.number.int({ min: 0, max: 10_000 }),
      playtimeMacForever: faker.number.int({ min: 0, max: 10_000 }),
      playtimeLinuxForever: faker.number.int({ min: 0, max: 10_000 }),
      playtimeDeckForever: faker.number.int({ min: 0, max: 10_000 }),
      playtimeDisconnected: faker.number.int({ min: 0, max: 10_000 }),
      rTimeLastPlayed: faker.number.int({
        min: 0,
        max: Math.floor(Date.now() / 1000),
      }),
      imgIconUrl: faker.internet.url(),
      capsuleFilename: faker.system.fileName(),
      hasCommunityVisibleStats: faker.datatype.boolean(),
      hasWorkshop: faker.datatype.boolean(),
      hasDlc: faker.datatype.boolean(),
      hasLeaderboards: faker.datatype.boolean(),
      ...overrides,
    })
    .returning()
    .get();
}

export function createGogGame(overrides: Partial<NewGogGame> = {}): GogGame {
  const gameId = overrides.gameId ?? createGame({ name: overrides.name }).id;
  const name = overrides.name ?? faker.commerce.productName();
  return db
    .insert(gogGame)
    .values({
      gameId,
      name,
      gogId: faker.number.int({ min: 1, max: 2_000_000_000 }),
      tags: [],
      properties: [],
      ...overrides,
    })
    .returning()
    .get();
}

export function createEpicGame(overrides: Partial<NewEpicGame> = {}): EpicGame {
  const gameId = overrides.gameId ?? createGame({ name: overrides.name }).id;
  const name = overrides.name ?? faker.commerce.productName();
  return db
    .insert(epicGame)
    .values({
      gameId,
      name,
      appName: faker.string.alphanumeric(32),
      namespace: faker.string.alphanumeric(32),
      catalogItemId: faker.string.alphanumeric(32),
      categories: [],
      ...overrides,
    })
    .returning()
    .get();
}

export function createSteamUser(
  overrides: Partial<NewSteamUser> = {},
): SteamUser {
  const owner = db.insert(user).values({}).returning().get();
  return db
    .insert(steamUser)
    .values({
      steamId: faker.string.numeric(17),
      userId: owner.id,
      personaName: faker.internet.username(),
      realName: faker.person.fullName(),
      profileUrl: faker.internet.url(),
      avatar: faker.internet.url(),
      avatarMedium: faker.internet.url(),
      avatarFull: faker.internet.url(),
      avatarHash: faker.string.alphanumeric(40),
      lastLogoff: faker.number.int({ min: 0, max: 2_000_000_000 }),
      apiKey: faker.string.hexadecimal({
        length: 32,
        casing: "upper",
        prefix: "",
      }),
      ...overrides,
    })
    .returning()
    .get();
}
