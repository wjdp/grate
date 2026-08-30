import { faker } from "@faker-js/faker";
import { db } from "~~/lib/db";
import {
  game,
  gogGame,
  steamGame,
  steamUser,
  user,
  type Game,
  type GogGame,
  type NewGame,
  type NewGogGame,
  type NewSteamGame,
  type NewSteamUser,
  type SteamGame,
  type SteamUser,
} from "~~/db/schema";

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

export function createSteamGame(
  overrides: Partial<NewSteamGame> = {},
): SteamGame {
  const linkedGame = createGame({ name: overrides.name });
  return db
    .insert(steamGame)
    .values({
      gameId: linkedGame.id,
      appId: faker.number.int({ min: 1, max: 2_000_000_000 }),
      name: linkedGame.name,
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
  const linkedGame = createGame({ name: overrides.name });
  return db
    .insert(gogGame)
    .values({
      gameId: linkedGame.id,
      gogId: faker.number.int({ min: 1, max: 2_000_000_000 }),
      name: linkedGame.name,
      tags: [],
      properties: [],
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
      ...overrides,
    })
    .returning()
    .get();
}
