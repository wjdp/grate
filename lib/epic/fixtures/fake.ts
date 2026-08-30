import { faker } from "@faker-js/faker";
import {
  EpicCatalogItemSchema,
  EpicLibraryRecordSchema,
  EpicPlaytimeSchema,
  EpicTokenSchema,
  type EpicCatalogItem,
  type EpicLibraryRecord,
  type EpicPlaytime,
  type EpicToken,
} from "~~/lib/epic/api";
import { db } from "~~/lib/db";
import { epicUser, type EpicUser, type NewEpicUser } from "~~/db/schema";

export function generateFakeEpicToken(
  overrides: Partial<EpicToken> = {},
): EpicToken {
  const expiresIn = 129483;
  return EpicTokenSchema.parse({
    access_token: `eg1~${faker.string.alphanumeric(64)}`,
    expires_in: expiresIn,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    refresh_token: `eg1~${faker.string.alphanumeric(64)}`,
    refresh_expires: 1987200,
    refresh_expires_at: new Date(Date.now() + 1987200 * 1000).toISOString(),
    account_id: faker.string.hexadecimal({ length: 32, prefix: "" }),
    displayName: faker.internet.username(),
    client_id: faker.string.hexadecimal({ length: 32, prefix: "" }),
    ...overrides,
  });
}

export function generateFakeEpicLibraryRecord(
  overrides: Partial<EpicLibraryRecord> = {},
): EpicLibraryRecord {
  return EpicLibraryRecordSchema.parse({
    namespace: faker.string.hexadecimal({ length: 32, prefix: "" }),
    catalogItemId: faker.string.hexadecimal({ length: 32, prefix: "" }),
    appName: faker.string.alphanumeric(12),
    sandboxName: faker.commerce.productName(),
    sandboxType: "PUBLIC",
    recordType: "APPLICATION",
    acquisitionDate: faker.date.past().toISOString(),
    platform: ["Windows"],
    ...overrides,
  });
}

export function generateFakeEpicCatalogItem(
  overrides: Partial<EpicCatalogItem> = {},
): EpicCatalogItem {
  return EpicCatalogItemSchema.parse({
    id: faker.string.hexadecimal({ length: 32, prefix: "" }),
    namespace: faker.string.hexadecimal({ length: 32, prefix: "" }),
    title: faker.commerce.productName(),
    description: faker.lorem.sentence(),
    developer: faker.company.name(),
    categories: [{ path: "games" }, { path: "applications" }],
    creationDate: faker.date.past().toISOString(),
    releaseInfo: [
      { appId: faker.string.alphanumeric(12), platform: ["Windows"] },
    ],
    customAttributes: {},
    keyImages: [
      { type: "DieselGameBoxTall", url: faker.internet.url() },
      { type: "DieselGameBox", url: faker.internet.url() },
    ],
    entitlementType: "EXECUTABLE",
    ...overrides,
  });
}

export function generateFakeEpicPlaytime(
  overrides: Partial<EpicPlaytime> = {},
): EpicPlaytime {
  return EpicPlaytimeSchema.parse({
    artifactId: faker.string.alphanumeric(12),
    totalTime: faker.number.int({ min: 60, max: 300_000 }),
    ...overrides,
  });
}

export async function createEpicUser(
  overrides: Partial<NewEpicUser> = {},
): Promise<EpicUser> {
  return db
    .insert(epicUser)
    .values({
      accountId: faker.string.hexadecimal({ length: 32, prefix: "" }),
      displayName: faker.internet.username(),
      country: faker.location.countryCode(),
      accessToken: faker.string.alphanumeric(32),
      accessTokenExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
      refreshToken: faker.string.alphanumeric(32),
      refreshTokenExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
      ...overrides,
    })
    .returning()
    .get();
}
