import { desc, eq } from "drizzle-orm";
import {
  getGogGameDetail,
  getGogToken,
  getGogUserData,
  getGogUserGames,
  getGogUserPlaytimes,
  GogApiError,
  type GogGameDetail,
  type GogPlaytimeSessions,
  refreshGogToken,
} from "~~/lib/gog/api";
import tryCatch from "#shared/utils/tryCatch";
import htmlToBareDescription from "#shared/utils/htmlToBareDescription";
import { db } from "~~/lib/db";
import {
  game,
  gogGame,
  gogGamePlaytime,
  gogIgnoredProduct,
  gogUser,
  type Game,
  type GogGame,
  type GogUser,
} from "~~/db/schema";
import { refreshGameAggregates } from "~~/lib/gameAggregates";
import { countProviderRows } from "~~/lib/gameProviders";
import type { OnProgress, RecordPlaytimesResult } from "~~/lib/providerJobs";

function getTokenExpiresAt(expiresIn: number) {
  return new Date(Date.now() + expiresIn * 1000);
}

const TOKEN_EXPIRY_BUFFER = 120 * 1000; // 2 minutes in milliseconds

function hasTokenExpired(expiresAt: Date) {
  return expiresAt.getTime() - Date.now() < TOKEN_EXPIRY_BUFFER;
}

export async function createOrUpdateGogUser(code: string) {
  const { data: token, error: tokenError } = await tryCatch(getGogToken(code));
  if (tokenError) {
    throw new Error("Failed to authenticate with GOG");
  }
  const accessTokenExpiresAt = getTokenExpiresAt(token.expires_in);
  const { data: user, error: userError } = await tryCatch(
    getGogUserData(token.access_token),
  );
  if (userError) {
    throw new Error("Failed to get user data from GOG");
  }
  const currentGogUser = await getGogUser();
  if (!!currentGogUser && currentGogUser.gogUserId !== user.userId) {
    throw new Error("grate only supports a single GOG account");
  }
  return db
    .insert(gogUser)
    .values({
      gogUserId: user.userId,
      galaxyUserId: user.galaxyUserId,
      username: user.username,
      country: user.country,
      avatarUrl: user.avatar,
      checksumGames: user.checksum.games,
      accessToken: token.access_token,
      accessTokenExpiresAt,
      refreshToken: token.refresh_token,
    })
    .onConflictDoUpdate({
      target: gogUser.gogUserId,
      set: {
        username: user.username,
        country: user.country,
        avatarUrl: user.avatar,
        checksumGames: user.checksum.games,
        accessToken: token.access_token,
        accessTokenExpiresAt,
        refreshToken: token.refresh_token,
      },
    })
    .returning()
    .get();
}

export async function getGogUser() {
  return (await db.query.gogUser.findFirst()) ?? null;
}

export async function handleRefreshToken(user: GogUser): Promise<GogUser> {
  if (!hasTokenExpired(user.accessTokenExpiresAt)) return user;
  console.log("Refreshing GOG token");
  const { data: token, error: tokenError } = await tryCatch(
    refreshGogToken(user.refreshToken),
  );
  if (tokenError) {
    throw new Error("Failed to refresh GOG token");
  }
  const accessTokenExpiresAt = getTokenExpiresAt(token.expires_in);
  return db
    .update(gogUser)
    .set({
      accessToken: token.access_token,
      accessTokenExpiresAt,
      refreshToken: token.refresh_token,
    })
    .where(eq(gogUser.gogUserId, user.gogUserId))
    .returning()
    .get();
}

export async function updateGogUser() {
  const currentUser = await getGogUser();
  if (!currentUser) {
    return;
  }
  const user = await handleRefreshToken(currentUser);
  const { data, error } = await tryCatch(getGogUserData(user.accessToken));
  if (error) {
    throw new Error("Failed to get user data from GOG");
  }
  return db
    .update(gogUser)
    .set({
      username: data.username,
      country: data.country,
      avatarUrl: data.avatar,
      checksumGames: data.checksum.games,
    })
    .where(eq(gogUser.gogUserId, user.gogUserId))
    .returning()
    .get();
}

// GOG return multiple product types, but we only care about games
// Others are DLC, PACK
const GOG_PRODUCT_TYPES_INCLUDE = ["GAME"];
// GOG products that should always be ignored
const GOG_MANUALLY_IGNORED_PRODUCT_IDS = [1185685769];

async function ensureManualIgnores() {
  for (const gogId of GOG_MANUALLY_IGNORED_PRODUCT_IDS) {
    await db
      .insert(gogIgnoredProduct)
      .values({ gogId, reason: "MANUAL" })
      .onConflictDoNothing()
      .run();
  }
}

async function ignoreProduct(gogId: number, reason: string) {
  await db
    .insert(gogIgnoredProduct)
    .values({ gogId, reason })
    .onConflictDoUpdate({ target: gogIgnoredProduct.gogId, set: { reason } })
    .run();
}

export async function updateGogGames(onProgress?: OnProgress) {
  const currentUser = await getGogUser();
  if (!currentUser) {
    return;
  }
  const user = await handleRefreshToken(currentUser);
  await ensureManualIgnores();
  const { data: gameIds, error } = await tryCatch(
    getGogUserGames(user.accessToken),
  );
  if (error) {
    throw new Error("Failed to get user games from GOG");
  }
  const ignoredProducts = db
    .select({ gogId: gogIgnoredProduct.gogId })
    .from(gogIgnoredProduct)
    .all();
  const ignoredGogIds = new Set(ignoredProducts.map((p) => p.gogId));
  let failureCount = 0;
  for (const [index, gameId] of gameIds.entries()) {
    await onProgress?.({
      fraction: index / gameIds.length,
      message: `updated ${index}/${gameIds.length} games`,
    });
    if (ignoredGogIds.has(gameId)) continue;

    const { data: gameDetail, error: gameError } = await tryCatch(
      getGogGameDetail(gameId),
    );
    if (gameError || !gameDetail) {
      if (gameError instanceof GogApiError && gameError.statusCode === 404) {
        await ignoreProduct(gameId, "NOT_FOUND");
        console.log(`Ignoring GOG product ${gameId}: not found`);
        continue;
      }
      if (gameError instanceof GogApiError && gameError.retriable) {
        console.error(
          `Transient error fetching GOG game ${gameId}: ${gameError.message}`,
        );
      } else {
        console.error(`Failed to fetch GOG game ${gameId}: ${gameError}`);
      }
      failureCount++;
      continue;
    }

    const productType = gameDetail._embedded.productType;
    const gogId = gameDetail._embedded.product.id;
    const gogGameTitle = gameDetail._embedded.product.title;

    if (!GOG_PRODUCT_TYPES_INCLUDE.includes(productType)) {
      await ignoreProduct(gameId, productType);
      continue;
    }

    const { error: writeError } = await tryCatch(
      updateOrCreateGogGame(gameDetail, gogId, gogGameTitle),
    );
    if (writeError) {
      console.error(`Failed to store GOG game ${gogId}: ${writeError}`);
      failureCount++;
    }
  }
  await onProgress?.({
    fraction: 1,
    message: `updated ${gameIds.length}/${gameIds.length} games`,
  });
  if (failureCount > 0) {
    console.error(`Failed to sync ${failureCount} GOG products`);
  }
}

async function updateOrCreateGogGame(
  gogGameDetail: GogGameDetail,
  gogId: number,
  gogGameTitle: string,
) {
  const existingGame = await db.query.gogGame.findFirst({
    where: eq(gogGame.gogId, gogId),
  });
  if (existingGame) {
    const updated = await updateGame(gogGameDetail);
    await refreshGameAggregates(updated.gameId);
    console.log(`Updated game ${gogGameTitle}`);
    return;
  }
  const created = await createGame(gogGameDetail);
  await refreshGameAggregates(created.id);
  console.log(`Created game ${gogGameTitle}`);
}

function releaseDateOf(gogGameDetail: GogGameDetail): Date | null {
  const value =
    gogGameDetail._embedded.product.globalReleaseDate ||
    gogGameDetail._embedded.product.gogReleaseDate;
  if (!value) return null;
  const releaseDate = new Date(value);
  if (Number.isNaN(releaseDate.getTime())) {
    throw new Error(`Invalid GOG release date: ${value}`);
  }
  return releaseDate;
}

function gogGameFields(gogGameDetail: GogGameDetail) {
  return {
    name: gogGameDetail._embedded.product.title,
    productType: gogGameDetail._embedded.productType,
    releaseDate: releaseDateOf(gogGameDetail),
    description: htmlToBareDescription(gogGameDetail.description),
    publisher: gogGameDetail._embedded.publisher.name,
    developer: gogGameDetail._embedded.developers
      .map((dev) => dev.name)
      .join(", "),
    tags: gogGameDetail._embedded.tags,
    properties: gogGameDetail._embedded.properties,
    iconUrl: gogGameDetail._links.icon?.href,
    iconSquareUrl: gogGameDetail._links.iconSquare?.href,
    logoUrl: gogGameDetail._links.logo?.href,
    boxArtImageUrl: gogGameDetail._links.boxArtImage?.href,
    backgroundImageUrl: gogGameDetail._links.backgroundImage?.href,
    galaxyBackgroundImageUrl: gogGameDetail._links.galaxyBackgroundImage?.href,
  };
}

async function createGame(gogGameDetail: GogGameDetail): Promise<Game> {
  const fields = gogGameFields(gogGameDetail);
  return db.transaction((tx) => {
    const createdGame = tx
      .insert(game)
      .values({ name: gogGameDetail._embedded.product.title })
      .returning()
      .get();
    tx.insert(gogGame)
      .values({
        gogId: gogGameDetail._embedded.product.id,
        gameId: createdGame.id,
        ...fields,
      })
      .run();
    return createdGame;
  });
}

async function updateGame(gogGameDetail: GogGameDetail): Promise<GogGame> {
  const fields = gogGameFields(gogGameDetail);
  return db.transaction((tx) => {
    const updated = tx
      .update(gogGame)
      .set(fields)
      .where(eq(gogGame.gogId, gogGameDetail._embedded.product.id))
      .returning()
      .get();
    if (countProviderRows(updated.gameId, tx) === 1) {
      tx.update(game)
        .set({ name: fields.name })
        .where(eq(game.id, updated.gameId))
        .run();
    }
    return updated;
  });
}

function gogLastPlayedAt(sessions: GogPlaytimeSessions): Date | null {
  return sessions.last_session_date
    ? new Date(sessions.last_session_date * 1000)
    : null;
}

export async function recordGogPlaytime(
  playedGame: GogGame,
  sessions: GogPlaytimeSessions,
  now: Date,
) {
  const [lastRecord, penultimateRecord] = db
    .select()
    .from(gogGamePlaytime)
    .where(eq(gogGamePlaytime.gogId, playedGame.gogId))
    .orderBy(desc(gogGamePlaytime.timestampEnd))
    .limit(2)
    .all();
  const lastPlayedAt = gogLastPlayedAt(sessions);
  let record;
  if (!lastRecord && lastPlayedAt && lastPlayedAt < now) {
    const values = {
      gogId: playedGame.gogId,
      playtimeMinutes: sessions.time_sum,
      lastPlayedAt,
    };
    db.insert(gogGamePlaytime)
      .values({ ...values, timestampStart: null, timestampEnd: lastPlayedAt })
      .run();
    record = db
      .insert(gogGamePlaytime)
      .values({ ...values, timestampStart: lastPlayedAt, timestampEnd: now })
      .returning()
      .get();
    console.log(
      `Recorded initial playtime for ${playedGame.name} grounded on its last session`,
    );
  } else if (
    lastRecord?.playtimeMinutes === sessions.time_sum &&
    penultimateRecord?.playtimeMinutes === sessions.time_sum
  ) {
    console.log(`No new playtime for ${playedGame.name}`);
    record = db
      .update(gogGamePlaytime)
      .set({ timestampEnd: now })
      .where(eq(gogGamePlaytime.id, lastRecord.id))
      .returning()
      .get();
  } else {
    record = db
      .insert(gogGamePlaytime)
      .values({
        gogId: playedGame.gogId,
        timestampStart: lastRecord ? lastRecord.timestampEnd : undefined,
        timestampEnd: now,
        playtimeMinutes: sessions.time_sum,
        lastPlayedAt,
      })
      .returning()
      .get();
    console.log(`Recorded playtime for ${playedGame.name}`);
  }
  db.update(gogGame)
    .set({ playtimeMinutes: sessions.time_sum, lastPlayedAt })
    .where(eq(gogGame.gogId, playedGame.gogId))
    .run();
  await refreshGameAggregates(playedGame.gameId);
  return record;
}

const NOTHING_RECORDED: RecordPlaytimesResult = {
  gamesCreated: 0,
  unknownGames: 0,
};

export async function recordGogPlaytimes(
  onProgress?: OnProgress,
): Promise<RecordPlaytimesResult> {
  const currentUser = await getGogUser();
  if (!currentUser) {
    return NOTHING_RECORDED;
  }
  const user = await handleRefreshToken(currentUser);
  const { data: playtimes, error } = await tryCatch(
    getGogUserPlaytimes(user.galaxyUserId, user.accessToken),
  );
  if (error || !playtimes) {
    console.error(`Failed to fetch GOG playtimes: ${error}`);
    return NOTHING_RECORDED;
  }
  const playtimeByGogId = new Map(
    playtimes.game_time.map((entry) => [entry.game_id, entry]),
  );
  const gogGames = db.select().from(gogGame).all();
  await onProgress?.({
    fraction: 0,
    message: `fetched playtime for ${playtimeByGogId.size} games`,
  });
  const knownGogIds = new Set(gogGames.map((row) => row.gogId));
  const ignoredGogIds = new Set(
    db
      .select({ gogId: gogIgnoredProduct.gogId })
      .from(gogIgnoredProduct)
      .all()
      .map((row) => row.gogId),
  );
  const unknownGames = [...playtimeByGogId.values()].filter(
    (entry) =>
      entry.time_sum > 0 &&
      !knownGogIds.has(entry.game_id) &&
      !ignoredGogIds.has(entry.game_id),
  ).length;
  const now = new Date();
  for (const playedGame of gogGames) {
    const sessions = playtimeByGogId.get(playedGame.gogId) ?? { time_sum: 0 };
    await recordGogPlaytime(playedGame, sessions, now);
  }
  await onProgress?.({
    fraction: 1,
    message: `recorded playtime for ${gogGames.length} games, ${unknownGames} unknown`,
  });
  return { gamesCreated: 0, unknownGames };
}

export async function getGogPlaytimeRecords(gogId: number) {
  return db
    .select()
    .from(gogGamePlaytime)
    .where(eq(gogGamePlaytime.gogId, gogId))
    .all();
}
