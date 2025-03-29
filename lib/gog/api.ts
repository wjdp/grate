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

export async function getGogUserGames(accessToken: string): Promise<number[]> {
  const response = await fetch("https://embed.gog.com/user/data/games", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    console.error(await response.text());
    throw createGogApiError(response);
  }
  const data = await response.json();
  if (!data?.owned) {
    throw new GogApiError({
      message: "No games found",
      statusCode: 404,
    });
  }
  return data.owned;
}

const GogProductLink = z.object({ href: z.string().nullable() });

const GogGameDetailSchema = z.object({
  description: z.string(),
  overview: z.string(),
  _links: z.object({
    store: GogProductLink.optional(),
    forum: GogProductLink.optional(),
    icon: GogProductLink.optional(),
    iconSquare: GogProductLink.optional(),
    logo: GogProductLink.optional(),
    boxArtImage: GogProductLink.optional(),
    backgroundImage: GogProductLink.optional(),
    galaxyBackgroundImage: GogProductLink.optional(),
  }),
  _embedded: z.object({
    product: z.object({
      id: z.number(),
      title: z.string(),
      globalReleaseDate: z.string().datetime({ offset: true }).optional(),
      gogReleaseDate: z.string().datetime({ offset: true }),
      isVisibleInAccount: z.boolean(),
      hasProductCard: z.boolean(),
    }),
    productType: z.string(),
    publisher: z.object({ name: z.string() }),
    developers: z.array(z.object({ name: z.string() })),
    tags: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        level: z.number(),
        slug: z.string(),
      }),
    ),
    properties: z.array(
      z.object({
        name: z.string(),
        slug: z.string(),
      }),
    ),
  }),
});

export type GogGameDetail = z.infer<typeof GogGameDetailSchema>;

export async function getGogGameDetail(id: number): Promise<GogGameDetail> {
  const response = await fetch(`https://api.gog.com/v2/games/${id}`);
  if (!response.ok) {
    console.error(await response.text());
    throw createGogApiError(response);
  }
  const data = await response.json();
  try {
    console.log(`Parsing game ${id}`);
    return GogGameDetailSchema.parse(data);
  } catch (e) {
    console.error(e);
    throw e;
  }
}
