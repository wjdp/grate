import { getGogToken, getGogUserData, refreshGogToken } from "~/lib/gog/api";
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
