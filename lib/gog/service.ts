import {
  getGogGameDetail,
  getGogToken,
  getGogUserData,
  getGogUserGames,
  GogGameDetail,
  refreshGogToken,
} from "~/lib/gog/api";
import tryCatch from "~/utils/tryCatch";
import prisma from "~/lib/prisma";
import type { GogUser } from "@prisma/client";

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
// GOG products that should be ignored
const GOG_IGNORED_PRODUCT_IDS = [1185685769];

export async function updateGogGames() {
  const currentUser = await getGogUser();
  if (!currentUser) {
    return;
  }
  const user = await handleRefreshToken(currentUser);
  const { data: gameIds, error } = await tryCatch(
    getGogUserGames(user.accessToken),
  );
  if (error) {
    throw new Error("Failed to get user games from GOG");
  }
  for (const gameId of gameIds) {
    const { data: game, error: gameError } = await tryCatch(
      getGogGameDetail(gameId),
    );
    // Some are expected 404s, so for now just skip and continue
    if (gameError || !game) continue;

    const isGame = GOG_PRODUCT_TYPES_INCLUDE.includes(
      game._embedded.productType,
    );
    // Only process games, ignore DLCs and packs
    if (!isGame) continue;

    const gogId = game._embedded.product.id;
    const gogGameTitle = game._embedded.product.title;

    if (GOG_IGNORED_PRODUCT_IDS.includes(gogId)) continue;

    const existingGame = await prisma.gogGame.findFirst({
      where: { gogId: gogId },
    });
    if (existingGame) {
      await updateGame(game);
      console.log(`Updated game ${gogGameTitle}`);
    } else {
      await createGame(game);
      console.log(`Created game ${gogGameTitle}`);
    }
  }
}

async function createGame(gogGameDetail: GogGameDetail) {
  return await prisma.game.create({
    data: {
      name: gogGameDetail._embedded.product.title,
      gogGame: {
        create: {
          gogId: gogGameDetail._embedded.product.id,
          name: gogGameDetail._embedded.product.title,
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
  return await prisma.gogGame.update({
    where: { gogId: gogGameDetail._embedded.product.id },
    data: {
      name: gogGameDetail._embedded.product.title,
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
