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
import prisma from "~/lib/prisma";
import { refreshGameAggregates } from "~/lib/gameAggregates";
import type { GogGame, GogUser } from "@prisma/client";

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
  const currentGogUser = await prisma.gogUser.findFirst();
  if (!!currentGogUser && currentGogUser.gogUserId !== user.userId) {
    throw new Error("grate only supports a single GOG account");
  }
  return prisma.gogUser.upsert({
    where: { gogUserId: user.userId },
    create: {
      gogUserId: user.userId,
      galaxyUserId: user.galaxyUserId,
      username: user.username,
      country: user.country,
      avatarUrl: user.avatar,
      checksumGames: user.checksum.games,
      accessToken: token.access_token,
      accessTokenExpiresAt,
      refreshToken: token.refresh_token,
    },
    update: {
      username: user.username,
      country: user.country,
      avatarUrl: user.avatar,
      checksumGames: user.checksum.games,
      accessToken: token.access_token,
      accessTokenExpiresAt,
      refreshToken: token.refresh_token,
    },
  });
}

export async function getGogUser() {
  return prisma.gogUser.findFirst();
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
  return prisma.gogUser.update({
    where: { gogUserId: user.gogUserId },
    data: {
      accessToken: token.access_token,
      accessTokenExpiresAt,
      refreshToken: token.refresh_token,
    },
  });
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
  return prisma.gogUser.update({
    where: { gogUserId: user.gogUserId },
    data: {
      username: data.username,
      country: data.country,
      avatarUrl: data.avatar,
      checksumGames: data.checksum.games,
    },
  });
}

// GOG return multiple product types, but we only care about games
// Others are DLC, PACK
const GOG_PRODUCT_TYPES_INCLUDE = ["GAME"];
// GOG products that should always be ignored
const GOG_MANUALLY_IGNORED_PRODUCT_IDS = [1185685769];

async function ensureManualIgnores() {
  for (const gogId of GOG_MANUALLY_IGNORED_PRODUCT_IDS) {
    await prisma.gogIgnoredProduct.upsert({
      where: { gogId },
      create: { gogId, reason: "MANUAL" },
      update: {},
    });
  }
}

async function ignoreProduct(gogId: number, reason: string) {
  await prisma.gogIgnoredProduct.upsert({
    where: { gogId },
    create: { gogId, reason },
    update: { reason },
  });
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
  const ignoredProducts = await prisma.gogIgnoredProduct.findMany({
    select: { gogId: true },
  });
  const ignoredGogIds = new Set(ignoredProducts.map((p) => p.gogId));
  let failureCount = 0;
  for (const gameId of gameIds) {
    if (ignoredGogIds.has(gameId)) continue;

    const { data: game, error: gameError } = await tryCatch(
      getGogGameDetail(gameId),
    );
    if (gameError || !game) {
      if (gameError instanceof GogApiError && gameError.statusCode === 404) {
        await ignoreProduct(gameId, "NOT_FOUND");
      } else if (gameError instanceof GogApiError && gameError.retriable) {
        console.error(
          `Transient error fetching GOG game ${gameId}: ${gameError.message}`,
        );
      } else {
        console.error(`Failed to fetch GOG game ${gameId}: ${gameError}`);
      }
      failureCount++;
      continue;
    }

    const productType = game._embedded.productType;
    const gogId = game._embedded.product.id;
    const gogGameTitle = game._embedded.product.title;

    if (!GOG_PRODUCT_TYPES_INCLUDE.includes(productType)) {
      await ignoreProduct(gameId, productType);
      continue;
    }

    const { error: writeError } = await tryCatch(
      updateOrCreateGogGame(game, gogId, gogGameTitle),
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
  game: GogGameDetail,
  gogId: number,
  gogGameTitle: string,
) {
  const existingGame = await prisma.gogGame.findFirst({
    where: { gogId },
  });
  if (existingGame) {
    const updated = await updateGame(game);
    await refreshGameAggregates(updated.gameId);
    console.log(`Updated game ${gogGameTitle}`);
    return;
  }
  const created = await createGame(game);
  await refreshGameAggregates(created.id);
  console.log(`Created game ${gogGameTitle}`);
}

async function createGame(gogGameDetail: GogGameDetail) {
  return await prisma.game.create({
    data: {
      name: gogGameDetail._embedded.product.title,
      gogGame: {
        create: {
          gogId: gogGameDetail._embedded.product.id,
          name: gogGameDetail._embedded.product.title,
          productType: gogGameDetail._embedded.productType,
          releaseDate:
            gogGameDetail._embedded.product.globalReleaseDate ||
            gogGameDetail._embedded.product.gogReleaseDate,
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
          galaxyBackgroundImageUrl:
            gogGameDetail._links.galaxyBackgroundImage?.href,
        },
      },
    },
  });
}

async function updateGame(gogGameDetail: GogGameDetail) {
  const title = gogGameDetail._embedded.product.title;
  return await prisma.gogGame.update({
    where: { gogId: gogGameDetail._embedded.product.id },
    data: {
      name: title,
      productType: gogGameDetail._embedded.productType,
      game: { update: { name: title } },
      releaseDate:
        gogGameDetail._embedded.product.globalReleaseDate ||
        gogGameDetail._embedded.product.gogReleaseDate,
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
      galaxyBackgroundImageUrl:
        gogGameDetail._links.galaxyBackgroundImage?.href,
    },
  });
}

function gogLastPlayedAt(sessions: GogPlaytimeSessions): Date | null {
  return sessions.last_session_date
    ? new Date(sessions.last_session_date * 1000)
    : null;
}

export async function recordGogPlaytime(
  gogGame: GogGame,
  sessions: GogPlaytimeSessions,
  now: Date,
) {
  const [lastRecord, penultimateRecord] = await prisma.gogGamePlaytime.findMany(
    {
      where: { gogId: gogGame.gogId },
      orderBy: { timestampEnd: "desc" },
      take: 2,
    },
  );
  const lastPlayedAt = gogLastPlayedAt(sessions);
  let record;
  if (
    lastRecord?.playtimeMinutes === sessions.time_sum &&
    penultimateRecord?.playtimeMinutes === sessions.time_sum
  ) {
    console.log(`No new playtime for ${gogGame.name}`);
    record = await prisma.gogGamePlaytime.update({
      where: { id: lastRecord.id },
      data: { timestampEnd: now },
    });
  } else {
    record = await prisma.gogGamePlaytime.create({
      data: {
        gogGame: { connect: { gogId: gogGame.gogId } },
        timestampStart: lastRecord ? lastRecord.timestampEnd : undefined,
        timestampEnd: now,
        playtimeMinutes: sessions.time_sum,
        lastPlayedAt,
      },
    });
    console.log(`Recorded playtime for ${gogGame.name}`);
  }
  await prisma.gogGame.update({
    where: { gogId: gogGame.gogId },
    data: { playtimeMinutes: sessions.time_sum, lastPlayedAt },
  });
  await refreshGameAggregates(gogGame.gameId);
  return record;
}

export async function recordGogPlaytimes() {
  const currentUser = await getGogUser();
  if (!currentUser) {
    return;
  }
  const user = await handleRefreshToken(currentUser);
  const gogGames = await prisma.gogGame.findMany();
  const now = new Date();
  for (const gogGame of gogGames) {
    const { data: sessions, error } = await tryCatch(
      getGogGamePlaytime(gogGame.gogId, user.gogUserId, user.accessToken),
    );
    if (error || !sessions) {
      console.error(
        `Failed to fetch GOG playtime for ${gogGame.name}: ${error}`,
      );
      continue;
    }
    await recordGogPlaytime(gogGame, sessions, now);
  }
}

export async function getGogPlaytimeRecords(gogId: number) {
  return prisma.gogGamePlaytime.findMany({ where: { gogId } });
}
