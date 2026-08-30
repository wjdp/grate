import { faker } from "@faker-js/faker";
import {
  GogGameDetailSchema,
  GogPlaytimeSessionsSchema,
  GogTokenSchema,
  GogUserSchema,
  type getGogToken,
  type getGogUserData,
  type GogGameDetail,
  type GogPlaytimeSessions,
} from "~~/lib/gog/api";
import { db } from "~~/lib/db";
import { gogUser, type GogUser, type NewGogUser } from "~~/db/schema";

type GogToken = Awaited<ReturnType<typeof getGogToken>>;
type GogApiUser = Awaited<ReturnType<typeof getGogUserData>>;

export function generateFakeGogToken(
  overrides: Partial<GogToken> = {},
): GogToken {
  return GogTokenSchema.parse({
    access_token: faker.string.alphanumeric(32),
    token_type: "bearer",
    expires_in: 3600,
    refresh_token: faker.string.alphanumeric(32),
    scope: "",
    user_id: faker.string.numeric(18),
    session_id: faker.string.alphanumeric(16),
    ...overrides,
  });
}

export function generateFakeGogUser(
  overrides: Partial<GogApiUser> = {},
): GogApiUser {
  return GogUserSchema.parse({
    userId: faker.string.numeric(18),
    username: faker.internet.username(),
    galaxyUserId: faker.string.numeric(18),
    country: faker.location.countryCode(),
    avatar: faker.internet.url(),
    checksum: { games: faker.string.alphanumeric(32) },
    ...overrides,
  });
}

export interface FakeGogGameDetailOverrides {
  id?: number;
  title?: string;
  productType?: string;
  globalReleaseDate?: string;
  gogReleaseDate?: string;
  developers?: { name: string }[];
  publisher?: string;
  description?: string;
  links?: Partial<GogGameDetail["_links"]>;
}

export function generateFakeGogGameDetail(
  overrides: FakeGogGameDetailOverrides = {},
): GogGameDetail {
  return GogGameDetailSchema.parse({
    description: overrides.description ?? faker.lorem.paragraph(),
    overview: faker.lorem.sentence(),
    _links: {
      icon: { href: faker.internet.url() },
      iconSquare: { href: faker.internet.url() },
      logo: { href: faker.internet.url() },
      boxArtImage: { href: faker.internet.url() },
      backgroundImage: { href: faker.internet.url() },
      galaxyBackgroundImage: { href: faker.internet.url() },
      ...overrides.links,
    },
    _embedded: {
      product: {
        id: overrides.id ?? faker.number.int({ min: 1, max: 2_000_000_000 }),
        title: overrides.title ?? faker.commerce.productName(),
        globalReleaseDate: overrides.globalReleaseDate,
        gogReleaseDate:
          overrides.gogReleaseDate ?? "2015-05-19T00:00:00.000+00:00",
        isVisibleInAccount: true,
        hasProductCard: true,
      },
      productType: overrides.productType ?? "GAME",
      publisher: { name: overrides.publisher ?? faker.company.name() },
      developers: overrides.developers ?? [{ name: faker.company.name() }],
      tags: [{ id: 1, name: "RPG", level: 1, slug: "rpg" }],
      properties: [{ name: "Windows", slug: "windows" }],
    },
  });
}

export async function createGogUser(
  overrides: Partial<NewGogUser> = {},
): Promise<GogUser> {
  return db
    .insert(gogUser)
    .values({
      gogUserId: faker.string.numeric(18),
      galaxyUserId: faker.string.numeric(18),
      username: faker.internet.username(),
      country: faker.location.countryCode(),
      checksumGames: faker.string.alphanumeric(32),
      avatarUrl: faker.internet.url(),
      accessToken: faker.string.alphanumeric(32),
      accessTokenExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
      refreshToken: faker.string.alphanumeric(32),
      ...overrides,
    })
    .returning()
    .get();
}

export function generateFakeGogPlaytimeSessions(
  overrides: Partial<GogPlaytimeSessions> = {},
): GogPlaytimeSessions {
  return GogPlaytimeSessionsSchema.parse({
    game_id: faker.number.int({ min: 1, max: 2_000_000_000 }),
    user_id: faker.string.numeric(18),
    time_sum: faker.number.int({ min: 0, max: 10_000 }),
    last_session_date: Math.floor(faker.date.recent().getTime() / 1000),
    ...overrides,
  });
}
