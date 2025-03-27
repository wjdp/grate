import { z } from "zod";

export class GogApiError extends Error {
  statusCode: number;

  constructor({
    message,
    statusCode,
  }: {
    message: string;
    statusCode: number;
  }) {
    super(message);
    this.name = "GogApiError";
    this.statusCode = statusCode;
  }
}

function createGogApiError(response: Response): GogApiError {
  return new GogApiError({
    message: response.statusText,
    statusCode: response.status,
  });
}

// OAuth client that all the open-source launcher apps use
const GOG_CLIENT_ID = "46899977096215655";
const GOG_CLIENT_SECRET =
  "9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9";
const GOG_GRANT_TYPE = "authorization_code";
const GOG_REDIRECT_URI = "https://embed.gog.com/on_login_success?origin=client";

export function getGogLoginUri(): string {
  return `https://login.gog.com/auth?client_id=${GOG_CLIENT_ID}&redirect_uri=${GOG_REDIRECT_URI}&response_type=code&layout=client2`;
}

const GogTokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  refresh_token: z.string(),
  scope: z.string(),
  user_id: z.string(),
  session_id: z.string(),
});

type GogToken = z.infer<typeof GogTokenSchema>;

export async function getGogToken(code: string): Promise<GogToken> {
  const response = await fetch(
    `https://auth.gog.com/token?client_id=${GOG_CLIENT_ID}&client_secret=${GOG_CLIENT_SECRET}&grant_type=${GOG_GRANT_TYPE}&code=${code}&redirect_uri=${GOG_REDIRECT_URI}`,
  );
  const data = await response.json();
  if (!response.ok) {
    throw createGogApiError(response);
  }
  return GogTokenSchema.parse(data);
}

export async function refreshGogToken(refreshToken: string): Promise<GogToken> {
  const response = await fetch(
    `https://auth.gog.com/token?client_id=${GOG_CLIENT_ID}&client_secret=${GOG_CLIENT_SECRET}&grant_type=refresh_token&refresh_token=${refreshToken}`,
  );
  const data = await response.json();
  if (!response.ok) {
    console.error(data);
    throw createGogApiError(response);
  }
  return GogTokenSchema.parse(data);
}

const GogUserSchema = z.object({
  userId: z.string(),
  username: z.string(),
  galaxyUserId: z.string(),
  country: z.string(),
  avatar: z.string(),
  checksum: z.object({
    games: z.string(),
  }),
});

type GogUser = z.infer<typeof GogUserSchema>;

export async function getGogUserData(accessToken: string): Promise<GogUser> {
  const response = await fetch("https://embed.gog.com/userData.json", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok) {
    console.error(data);
    throw createGogApiError(response);
  }
  return GogUserSchema.parse(data);
}
