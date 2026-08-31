import { relations } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { GAME_STATES } from "../shared/game-state";

const autoIncrementId = () => integer().primaryKey({ autoIncrement: true });
const datetime = () => integer({ mode: "timestamp_ms" });
const boolean = () => integer({ mode: "boolean" });
const json = () => text({ mode: "json" });

export const STEAM_APP_INFO_STATES = [
  "FETCHED",
  "NOT_FETCHED",
  "UNAVAILABLE",
] as const;

export type SteamAppInfoState = (typeof STEAM_APP_INFO_STATES)[number];

export const user = sqliteTable("User", {
  id: autoIncrementId(),
});

export const steamUser = sqliteTable(
  "SteamUser",
  {
    steamId: text().primaryKey(),
    userId: integer()
      .notNull()
      .references(() => user.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    personaName: text().notNull(),
    realName: text(),
    profileUrl: text().notNull(),
    avatar: text().notNull(),
    avatarMedium: text().notNull(),
    avatarFull: text().notNull(),
    avatarHash: text().notNull(),
    lastLogoff: integer().notNull(),
    apiKey: text(),
  },
  (table) => [uniqueIndex("SteamUser_userId_key").on(table.userId)],
);

export const gogUser = sqliteTable("GogUser", {
  gogUserId: text().primaryKey(),
  galaxyUserId: text().notNull(),
  username: text().notNull(),
  country: text().notNull(),
  checksumGames: text().notNull(),
  avatarUrl: text().notNull(),
  accessToken: text().notNull(),
  accessTokenExpiresAt: datetime().notNull(),
  refreshToken: text().notNull(),
});

export const game = sqliteTable("Game", {
  id: autoIncrementId(),
  name: text().notNull(),
  state: text({ enum: GAME_STATES }),
  playtimeMinutes: integer().notNull().default(0),
  lastPlayedAt: datetime(),
});

export const gameStateChange = sqliteTable("GameStateChange", {
  id: autoIncrementId(),
  gameId: integer()
    .notNull()
    .references(() => game.id, { onDelete: "restrict", onUpdate: "cascade" }),
  state: text({ enum: GAME_STATES }),
  timestamp: datetime().notNull(),
});

export const gameDistinctPair = sqliteTable(
  "GameDistinctPair",
  {
    id: autoIncrementId(),
    gameAId: integer()
      .notNull()
      .references(() => game.id, { onDelete: "restrict", onUpdate: "cascade" }),
    gameBId: integer()
      .notNull()
      .references(() => game.id, { onDelete: "restrict", onUpdate: "cascade" }),
    createdAt: datetime()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("GameDistinctPair_pair_key").on(table.gameAId, table.gameBId),
  ],
);

export const steamGame = sqliteTable(
  "SteamGame",
  {
    appId: integer().primaryKey(),
    gameId: integer()
      .notNull()
      .references(() => game.id, { onDelete: "restrict", onUpdate: "cascade" }),
    appInfoState: text({ enum: STEAM_APP_INFO_STATES })
      .notNull()
      .default("NOT_FETCHED"),
    name: text().notNull(),
    playtimeForever: integer(),
    playtime2weeks: integer(),
    playtimeWindowsForever: integer(),
    playtimeMacForever: integer(),
    playtimeLinuxForever: integer(),
    playtimeDeckForever: integer(),
    playtimeDisconnected: integer(),
    rTimeLastPlayed: integer(),
    imgIconUrl: text().notNull(),
    capsuleFilename: text().notNull(),
    hasCommunityVisibleStats: boolean().notNull().default(false),
    hasWorkshop: boolean().notNull().default(false),
    hasDlc: boolean().notNull().default(false),
    hasLeaderboards: boolean().notNull().default(false),
  },
  (table) => [index("SteamGame_gameId_idx").on(table.gameId)],
);

export const steamAppInfo = sqliteTable("SteamAppInfo", {
  appId: integer()
    .primaryKey()
    .references(() => steamGame.appId, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  fetchedAt: datetime().notNull(),
  type: text().notNull(),
  name: text().notNull(),
  requiredAge: integer(),
  isFree: boolean().notNull(),
  detailedDescription: text().notNull(),
  aboutTheGame: text().notNull(),
  shortDescription: text().notNull(),
  headerImage: text().notNull(),
  capsuleImage: text().notNull(),
  capsuleImagev5: text().notNull(),
  website: text(),
  developers: json().$type<string[]>().notNull(),
  publishers: json().$type<string[]>().notNull(),
  platformWindows: boolean().notNull(),
  platformMac: boolean().notNull(),
  platformLinux: boolean().notNull(),
  metacriticScore: integer(),
  metacriticUrl: text(),
  categories: json().notNull(),
  genres: json().notNull(),
  screenshots: json().notNull(),
  releaseDate: datetime(),
  comingSoon: boolean(),
  background: text().notNull(),
  backgroundRaw: text().notNull(),
});

export interface SteamLogoPosition {
  pinnedPosition: string;
  widthPct: number;
  heightPct: number;
}

export interface SteamAssociation {
  type: string;
  name: string;
}

export const steamPicsMetadata = sqliteTable("SteamPicsMetadata", {
  appId: integer()
    .primaryKey()
    .references(() => steamGame.appId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  fetchedAt: datetime().notNull(),
  changenumber: integer(),
  // Library asset paths are opaque, relative to the store_item_assets CDN root
  capsulePath: text(),
  capsule2xPath: text(),
  heroPath: text(),
  hero2xPath: text(),
  heroBlurPath: text(),
  logoPath: text(),
  logo2xPath: text(),
  headerPath: text(),
  header2xPath: text(),
  logoPosition: json().$type<SteamLogoPosition | null>(),
  iconHash: text(),
  reviewScore: integer(),
  reviewPercentage: integer(),
  deckCompatibility: integer(),
  steamosCompatibility: integer(),
  steamMachineCompatibility: integer(),
  storeTags: json().$type<number[] | null>(),
  associations: json().$type<SteamAssociation[] | null>(),
  steamReleaseDate: datetime(),
  originalReleaseDate: datetime(),
  nameLocalized: json().$type<Record<string, string> | null>(),
  supportedLanguages: json().$type<Record<string, unknown> | null>(),
  osList: text(),
  controllerSupport: text(),
});

export const steamTag = sqliteTable("SteamTag", {
  tagId: integer().primaryKey(),
  name: text().notNull(),
});

export const steamGamePlaytime = sqliteTable("SteamGamePlaytime", {
  id: autoIncrementId(),
  steamAppId: integer()
    .notNull()
    .references(() => steamGame.appId, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  timestampStart: datetime(),
  timestampEnd: datetime().notNull(),
  playtimeForever: integer(),
  playtime2weeks: integer(),
  playtimeWindowsForever: integer(),
  playtimeMacForever: integer(),
  playtimeLinuxForever: integer(),
  playtimeDeckForever: integer(),
  playtimeDisconnected: integer(),
  rTimeLastPlayed: integer(),
});

export const gogGame = sqliteTable(
  "GogGame",
  {
    gogId: autoIncrementId(),
    gameId: integer()
      .notNull()
      .references(() => game.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: text().notNull(),
    releaseDate: datetime(),
    description: text(),
    publisher: text(),
    developer: text(),
    tags: json().notNull(),
    properties: json().notNull(),
    iconUrl: text(),
    iconSquareUrl: text(),
    logoUrl: text(),
    boxArtImageUrl: text(),
    backgroundImageUrl: text(),
    galaxyBackgroundImageUrl: text(),
    productType: text().notNull().default("GAME"),
    playtimeMinutes: integer(),
    lastPlayedAt: datetime(),
  },
  (table) => [index("GogGame_gameId_idx").on(table.gameId)],
);

export const gogGamePlaytime = sqliteTable("GogGamePlaytime", {
  id: autoIncrementId(),
  gogId: integer()
    .notNull()
    .references(() => gogGame.gogId, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  timestampStart: datetime(),
  timestampEnd: datetime().notNull(),
  playtimeMinutes: integer().notNull(),
  lastPlayedAt: datetime(),
});

export const gogIgnoredProduct = sqliteTable("GogIgnoredProduct", {
  gogId: autoIncrementId(),
  reason: text().notNull(),
  createdAt: datetime()
    .notNull()
    .$defaultFn(() => new Date()),
});

export const epicUser = sqliteTable("EpicUser", {
  accountId: text().primaryKey(),
  displayName: text().notNull(),
  country: text(),
  accessToken: text().notNull(),
  accessTokenExpiresAt: datetime().notNull(),
  refreshToken: text().notNull(),
  refreshTokenExpiresAt: datetime().notNull(),
});

export const epicGame = sqliteTable(
  "EpicGame",
  {
    epicId: autoIncrementId(),
    gameId: integer()
      .notNull()
      .references(() => game.id, { onDelete: "restrict", onUpdate: "cascade" }),
    appName: text().notNull(),
    namespace: text().notNull(),
    catalogItemId: text().notNull(),
    name: text().notNull(),
    description: text(),
    developer: text(),
    publisher: text(),
    releaseDate: datetime(),
    acquisitionDate: datetime(),
    categories: json().notNull(),
    boxArtTallUrl: text(),
    boxArtWideUrl: text(),
    logoUrl: text(),
    storeSlug: text(),
    thirdPartyStore: text(),
    playtimeMinutes: integer(),
    lastPlayedAt: datetime(),
  },
  (table) => [
    uniqueIndex("EpicGame_appName_key").on(table.appName),
    index("EpicGame_gameId_idx").on(table.gameId),
  ],
);

export const epicGamePlaytime = sqliteTable("EpicGamePlaytime", {
  id: autoIncrementId(),
  epicId: integer()
    .notNull()
    .references(() => epicGame.epicId, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  timestampStart: datetime(),
  timestampEnd: datetime().notNull(),
  playtimeMinutes: integer().notNull(),
  lastPlayedAt: datetime(),
});

export const epicIgnoredItem = sqliteTable("EpicIgnoredItem", {
  appName: text().primaryKey(),
  reason: text().notNull(),
  createdAt: datetime()
    .notNull()
    .$defaultFn(() => new Date()),
});

export const userRelations = relations(user, ({ one }) => ({
  steamUser: one(steamUser),
}));

export const steamUserRelations = relations(steamUser, ({ one }) => ({
  user: one(user, { fields: [steamUser.userId], references: [user.id] }),
}));

export const gameRelations = relations(game, ({ many }) => ({
  steamGames: many(steamGame),
  gogGames: many(gogGame),
  epicGames: many(epicGame),
  stateChanges: many(gameStateChange),
}));

export const gameStateChangeRelations = relations(
  gameStateChange,
  ({ one }) => ({
    game: one(game, {
      fields: [gameStateChange.gameId],
      references: [game.id],
    }),
  }),
);

export const steamGameRelations = relations(steamGame, ({ one, many }) => ({
  game: one(game, { fields: [steamGame.gameId], references: [game.id] }),
  appInfo: one(steamAppInfo),
  picsMetadata: one(steamPicsMetadata),
  playtimeRecords: many(steamGamePlaytime),
}));

export const steamAppInfoRelations = relations(steamAppInfo, ({ one }) => ({
  steamGame: one(steamGame, {
    fields: [steamAppInfo.appId],
    references: [steamGame.appId],
  }),
}));

export const steamPicsMetadataRelations = relations(
  steamPicsMetadata,
  ({ one }) => ({
    steamGame: one(steamGame, {
      fields: [steamPicsMetadata.appId],
      references: [steamGame.appId],
    }),
  }),
);

export const steamGamePlaytimeRelations = relations(
  steamGamePlaytime,
  ({ one }) => ({
    steamGame: one(steamGame, {
      fields: [steamGamePlaytime.steamAppId],
      references: [steamGame.appId],
    }),
  }),
);

export const gogGameRelations = relations(gogGame, ({ one, many }) => ({
  game: one(game, { fields: [gogGame.gameId], references: [game.id] }),
  playtimeRecords: many(gogGamePlaytime),
}));

export const gogGamePlaytimeRelations = relations(
  gogGamePlaytime,
  ({ one }) => ({
    gogGame: one(gogGame, {
      fields: [gogGamePlaytime.gogId],
      references: [gogGame.gogId],
    }),
  }),
);

export const epicGameRelations = relations(epicGame, ({ one, many }) => ({
  game: one(game, { fields: [epicGame.gameId], references: [game.id] }),
  playtimeRecords: many(epicGamePlaytime),
}));

export const epicGamePlaytimeRelations = relations(
  epicGamePlaytime,
  ({ one }) => ({
    epicGame: one(epicGame, {
      fields: [epicGamePlaytime.epicId],
      references: [epicGame.epicId],
    }),
  }),
);

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type SteamUser = typeof steamUser.$inferSelect;
export type NewSteamUser = typeof steamUser.$inferInsert;
export type GogUser = typeof gogUser.$inferSelect;
export type NewGogUser = typeof gogUser.$inferInsert;
export type EpicUser = typeof epicUser.$inferSelect;
export type NewEpicUser = typeof epicUser.$inferInsert;
export type Game = typeof game.$inferSelect;
export type NewGame = typeof game.$inferInsert;
export type GameStateChange = typeof gameStateChange.$inferSelect;
export type NewGameStateChange = typeof gameStateChange.$inferInsert;
export type GameDistinctPair = typeof gameDistinctPair.$inferSelect;
export type NewGameDistinctPair = typeof gameDistinctPair.$inferInsert;
export type SteamGame = typeof steamGame.$inferSelect;
export type NewSteamGame = typeof steamGame.$inferInsert;
export type SteamAppInfo = typeof steamAppInfo.$inferSelect;
export type NewSteamAppInfo = typeof steamAppInfo.$inferInsert;
export type SteamPicsMetadata = typeof steamPicsMetadata.$inferSelect;
export type NewSteamPicsMetadata = typeof steamPicsMetadata.$inferInsert;
export type SteamTag = typeof steamTag.$inferSelect;
export type NewSteamTag = typeof steamTag.$inferInsert;
export type SteamGamePlaytime = typeof steamGamePlaytime.$inferSelect;
export type NewSteamGamePlaytime = typeof steamGamePlaytime.$inferInsert;
export type GogGame = typeof gogGame.$inferSelect;
export type NewGogGame = typeof gogGame.$inferInsert;
export type GogGamePlaytime = typeof gogGamePlaytime.$inferSelect;
export type NewGogGamePlaytime = typeof gogGamePlaytime.$inferInsert;
export type GogIgnoredProduct = typeof gogIgnoredProduct.$inferSelect;
export type NewGogIgnoredProduct = typeof gogIgnoredProduct.$inferInsert;
export type EpicGame = typeof epicGame.$inferSelect;
export type NewEpicGame = typeof epicGame.$inferInsert;
export type EpicGamePlaytime = typeof epicGamePlaytime.$inferSelect;
export type NewEpicGamePlaytime = typeof epicGamePlaytime.$inferInsert;
export type EpicIgnoredItem = typeof epicIgnoredItem.$inferSelect;
export type NewEpicIgnoredItem = typeof epicIgnoredItem.$inferInsert;
