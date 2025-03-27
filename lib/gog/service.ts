import { getGogToken, getGogUserData } from "~/lib/gog/api";
import tryCatch from "~/utils/tryCatch";
import prisma from "~/lib/prisma";

function getTokenExpiresAt(expiresIn: number) {
  return new Date(Date.now() + expiresIn * 1000);
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
