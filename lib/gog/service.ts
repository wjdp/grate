import { desc, eq } from "drizzle-orm";
import {
  getGogGameDetail,
  getGogGamePlaytime,
  getGogToken,
  getGogUserData,
  getGogUserGames,
  GogApiError,
  type GogGameDetail,
  type GogPlaytimeSessions,
  refreshGogToken,
} from "~/lib/gog/api";
import tryCatch from "~/utils/tryCatch";
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
import { refreshGameAggregates } from "~/lib/gameAggregates";

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

export async function updateGogGames() {
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
  for (const gameId of gameIds) {
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
    description: gogGameDetail.description,
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
    tx.update(game)
      .set({ name: fields.name })
      .where(eq(game.id, updated.gameId))
      .run();
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
  if (
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

export async function recordGogPlaytimes() {
  const currentUser = await getGogUser();
  if (!currentUser) {
    return;
  }
  const user = await handleRefreshToken(currentUser);
  const gogGames = db.select().from(gogGame).all();
  const now = new Date();
  for (const playedGame of gogGames) {
    const { data: sessions, error } = await tryCatch(
      getGogGamePlaytime(playedGame.gogId, user.galaxyUserId, user.accessToken),
    );
    if (error || !sessions) {
      console.error(
        `Failed to fetch GOG playtime for ${playedGame.name}: ${error}`,
      );
      continue;
    }
    await recordGogPlaytime(playedGame, sessions, now);
  }
}

export async function getGogPlaytimeRecords(gogId: number) {
  return db
    .select()
    .from(gogGamePlaytime)
    .where(eq(gogGamePlaytime.gogId, gogId))
    .all();
}
