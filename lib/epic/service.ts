import { desc, eq } from "drizzle-orm";
import {
  EpicApiError,
  getEpicAccount,
  getEpicCatalogItems,
  getEpicLibraryItems,
  getEpicPlaytimes,
  getEpicStoreContent,
  getEpicStoreSlug,
  getEpicToken,
  refreshEpicToken,
  type EpicCatalogItem,
  type EpicLibraryRecord,
  type EpicToken,
} from "~/lib/epic/api";
import tryCatch from "~/utils/tryCatch";
import { db } from "~~/lib/db";
import {
  epicGame,
  epicGamePlaytime,
  epicIgnoredItem,
  epicUser,
  game,
  type EpicGame,
  type EpicUser,
} from "~~/db/schema";
import { refreshGameAggregates } from "~/lib/gameAggregates";
import { countProviderRows } from "~/lib/gameProviders";

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function accessTokenExpiresAt(token: EpicToken): Date {
  return (
    parseDate(token.expires_at) ??
    new Date(Date.now() + token.expires_in * 1000)
  );
}

const REFRESH_TOKEN_FALLBACK_SECONDS = 30 * 24 * 60 * 60;

export function refreshTokenExpiresAt(token: EpicToken): Date {
  return (
    parseDate(token.refresh_expires_at) ??
    new Date(
      Date.now() +
        (token.refresh_expires ?? REFRESH_TOKEN_FALLBACK_SECONDS) * 1000,
    )
  );
}

const TOKEN_EXPIRY_BUFFER = 120 * 1000; // 2 minutes in milliseconds

function hasTokenExpired(expiresAt: Date) {
  return expiresAt.getTime() - Date.now() < TOKEN_EXPIRY_BUFFER;
}

export async function getEpicUser() {
  return (await db.query.epicUser.findFirst()) ?? null;
}

export async function createOrUpdateEpicUser(code: string) {
  const { data: token, error: tokenError } = await tryCatch(getEpicToken(code));
  if (tokenError) {
    throw new Error(`Failed to authenticate with Epic: ${tokenError.message}`);
  }
  const currentEpicUser = await getEpicUser();
  if (!!currentEpicUser && currentEpicUser.accountId !== token.account_id) {
    throw new Error("grate only supports a single Epic account");
  }
  const { data: account } = await tryCatch(
    getEpicAccount(token.account_id, token.access_token),
  );
  const displayName = token.displayName ?? account?.displayName;
  if (!displayName) {
    throw new Error("Failed to get account details from Epic");
  }
  const values = {
    displayName,
    country: account?.country ?? null,
    accessToken: token.access_token,
    accessTokenExpiresAt: accessTokenExpiresAt(token),
    refreshToken: token.refresh_token,
    refreshTokenExpiresAt: refreshTokenExpiresAt(token),
  };
  return db
    .insert(epicUser)
    .values({ accountId: token.account_id, ...values })
    .onConflictDoUpdate({ target: epicUser.accountId, set: values })
    .returning()
    .get();
}

export async function handleRefreshToken(user: EpicUser): Promise<EpicUser> {
  if (!hasTokenExpired(user.accessTokenExpiresAt)) return user;
  if (hasTokenExpired(user.refreshTokenExpiresAt)) {
    throw new Error(
      "The Epic refresh token has expired, reconnect your Epic account",
    );
  }
  console.log("Refreshing Epic token");
  const { data: token, error: tokenError } = await tryCatch(
    refreshEpicToken(user.refreshToken),
  );
  if (tokenError) {
    throw new Error(`Failed to refresh Epic token: ${tokenError.message}`);
  }
  return db
    .update(epicUser)
    .set({
      accessToken: token.access_token,
      accessTokenExpiresAt: accessTokenExpiresAt(token),
      refreshToken: token.refresh_token,
      refreshTokenExpiresAt: refreshTokenExpiresAt(token),
    })
    .where(eq(epicUser.accountId, user.accountId))
    .returning()
    .get();
}

export async function updateEpicUser() {
  const currentUser = await getEpicUser();
  if (!currentUser) {
    return;
  }
  const user = await handleRefreshToken(currentUser);
  const { data: account, error } = await tryCatch(
    getEpicAccount(user.accountId, user.accessToken),
  );
  if (error) {
    throw new Error("Failed to get account details from Epic");
  }
  return db
    .update(epicUser)
    .set({ displayName: account.displayName, country: account.country ?? null })
    .where(eq(epicUser.accountId, user.accountId))
    .returning()
    .get();
}

const FAB_NAMESPACE = "89efe5924d3d467c839449ab6ab52e7f";
const UNREAL_CATEGORY_PATHS = ["assets", "asset-format", "plugins", "projects"];
const MOBILE_PLATFORMS = ["ANDROID", "IOS", "IOSAPPSTORE"];

async function ignoreItem(appName: string, reason: string) {
  await db
    .insert(epicIgnoredItem)
    .values({ appName, reason })
    .onConflictDoUpdate({ target: epicIgnoredItem.appName, set: { reason } })
    .run();
}

function recordIgnoreReason(record: EpicLibraryRecord): string | null {
  if (record.namespace === "ue") return "UE";
  if (record.sandboxName === "fab-listing-live") return "UE";
  if (record.namespace === FAB_NAMESPACE) return "UE";
  if (record.sandboxType && record.sandboxType !== "PUBLIC") return "PRIVATE";
  return null;
}

function categoryPaths(item: EpicCatalogItem): string[] {
  return item.categories.map((category) => category.path);
}

function isEditorResource(item: EpicCatalogItem): boolean {
  return (
    item.entitlementType === "AUDIENCE" ||
    categoryPaths(item).includes("type/format-item") ||
    !!item.customAttributes?.ListingIdentifier ||
    item.releaseInfo.some((release) => !!release.compatibleApps)
  );
}

function catalogIgnoreReason(item: EpicCatalogItem): string | null {
  if (item.mainGameItem) return "DLC";
  const paths = categoryPaths(item);
  if (paths.includes("mods")) return "MOD";
  if (
    paths.some(
      (path) =>
        UNREAL_CATEGORY_PATHS.includes(path) || path.startsWith("engines"),
    )
  ) {
    return "UE";
  }
  if (
    item.releaseInfo.length > 0 &&
    item.releaseInfo.every(
      (release) =>
        release.platform.length > 0 &&
        release.platform.every((platform) =>
          MOBILE_PLATFORMS.includes(platform.toUpperCase()),
        ),
    )
  ) {
    return "MOBILE_ONLY";
  }
  if (isEditorResource(item)) return "EDITOR_RESOURCE";
  return null;
}

function keyImageUrl(item: EpicCatalogItem, types: string[]): string | null {
  for (const type of types) {
    const image = item.keyImages.find((candidate) => candidate.type === type);
    if (image) return image.url;
  }
  return null;
}

function epicGameFields(record: EpicLibraryRecord, item: EpicCatalogItem) {
  return {
    name: item.title,
    description:
      item.description && item.description !== item.title
        ? item.description
        : null,
    developer: item.developer ?? null,
    categories: categoryPaths(item),
    acquisitionDate: parseDate(record.acquisitionDate),
    boxArtTallUrl: keyImageUrl(item, [
      "DieselGameBoxTall",
      "OfferImageTall",
      "DieselStoreFrontTall",
    ]),
    boxArtWideUrl: keyImageUrl(item, ["DieselGameBox", "OfferImageWide"]),
    logoUrl: keyImageUrl(item, ["DieselGameBoxLogo"]),
    thirdPartyStore: item.customAttributes?.ThirdPartyManagedApp?.value ?? null,
  };
}

type StoreFields = {
  storeSlug: string | null;
  releaseDate: Date | null;
  publisher: string | null;
  description?: string;
};

async function fetchStoreFields(namespace: string): Promise<StoreFields> {
  const slug = await getEpicStoreSlug(namespace);
  if (!slug) return { storeSlug: null, releaseDate: null, publisher: null };
  const content = await getEpicStoreContent(slug);
  if (!content) return { storeSlug: slug, releaseDate: null, publisher: null };
  return {
    storeSlug: slug,
    releaseDate: parseDate(content.releaseDate),
    publisher: content.publisher?.length ? content.publisher.join(", ") : null,
    ...(content.shortDescription
      ? { description: content.shortDescription }
      : {}),
  };
}

async function storeEnrichment(namespace: string): Promise<StoreFields> {
  const { data, error } = await tryCatch(fetchStoreFields(namespace));
  if (error || !data) {
    console.error(`Failed to enrich Epic namespace ${namespace}: ${error}`);
    return { storeSlug: null, releaseDate: null, publisher: null };
  }
  return data;
}

async function updateOrCreateEpicGame(
  record: EpicLibraryRecord,
  item: EpicCatalogItem,
) {
  const fields = epicGameFields(record, item);
  const existing = await db.query.epicGame.findFirst({
    where: eq(epicGame.appName, record.appName),
  });
  if (existing) {
    const store = existing.storeSlug
      ? null
      : await storeEnrichment(record.namespace);
    const updated = db.transaction((tx) => {
      const row = tx
        .update(epicGame)
        .set({ ...fields, ...(store ?? {}) })
        .where(eq(epicGame.appName, record.appName))
        .returning()
        .get();
      if (countProviderRows(row.gameId, tx) === 1) {
        tx.update(game)
          .set({ name: fields.name })
          .where(eq(game.id, row.gameId))
          .run();
      }
      return row;
    });
    await refreshGameAggregates(updated.gameId);
    console.log(`Updated game ${fields.name}`);
    return;
  }
  const store = await storeEnrichment(record.namespace);
  const created = db.transaction((tx) => {
    const createdGame = tx
      .insert(game)
      .values({ name: fields.name })
      .returning()
      .get();
    tx.insert(epicGame)
      .values({
        gameId: createdGame.id,
        appName: record.appName,
        namespace: record.namespace,
        catalogItemId: record.catalogItemId,
        ...fields,
        ...store,
      })
      .run();
    return createdGame;
  });
  await refreshGameAggregates(created.id);
  console.log(`Created game ${fields.name}`);
}

export async function updateEpicGames() {
  const currentUser = await getEpicUser();
  if (!currentUser) {
    return;
  }
  const user = await handleRefreshToken(currentUser);
  const { data: records, error } = await tryCatch(
    getEpicLibraryItems(user.accessToken),
  );
  if (error) {
    throw new Error("Failed to get library items from Epic");
  }
  const ignoredAppNames = new Set(
    db
      .select({ appName: epicIgnoredItem.appName })
      .from(epicIgnoredItem)
      .all()
      .map((item) => item.appName),
  );
  const recordsByNamespace = new Map<string, EpicLibraryRecord[]>();
  for (const record of records) {
    if (ignoredAppNames.has(record.appName)) continue;
    const reason = recordIgnoreReason(record);
    if (reason) {
      await ignoreItem(record.appName, reason);
      continue;
    }
    const forNamespace = recordsByNamespace.get(record.namespace) ?? [];
    forNamespace.push(record);
    recordsByNamespace.set(record.namespace, forNamespace);
  }

  let failureCount = 0;
  for (const [namespace, namespaceRecords] of recordsByNamespace) {
    const { data: items, error: catalogError } = await tryCatch(
      getEpicCatalogItems(
        namespace,
        namespaceRecords.map((record) => record.catalogItemId),
        user.accessToken,
      ),
    );
    if (catalogError || !items) {
      if (catalogError instanceof EpicApiError && catalogError.retriable) {
        console.error(
          `Transient error fetching Epic catalog for ${namespace}: ${catalogError.message}`,
        );
      } else {
        console.error(
          `Failed to fetch Epic catalog for ${namespace}: ${catalogError}`,
        );
      }
      failureCount += namespaceRecords.length;
      continue;
    }
    for (const record of namespaceRecords) {
      const item = items[record.catalogItemId];
      if (!item) {
        await ignoreItem(record.appName, "NOT_FOUND");
        console.log(`Ignoring Epic item ${record.appName}: not found`);
        continue;
      }
      const reason = catalogIgnoreReason(item);
      if (reason) {
        await ignoreItem(record.appName, reason);
        continue;
      }
      const { error: writeError } = await tryCatch(
        updateOrCreateEpicGame(record, item),
      );
      if (writeError) {
        console.error(
          `Failed to store Epic game ${record.appName}: ${writeError}`,
        );
        failureCount++;
      }
    }
  }
  if (failureCount > 0) {
    console.error(`Failed to sync ${failureCount} Epic items`);
  }
}

export async function recordEpicPlaytime(
  playedGame: EpicGame,
  totalTimeSeconds: number,
  now: Date,
) {
  const playtimeMinutes = Math.floor(totalTimeSeconds / 60);
  const [lastRecord, penultimateRecord] = db
    .select()
    .from(epicGamePlaytime)
    .where(eq(epicGamePlaytime.epicId, playedGame.epicId))
    .orderBy(desc(epicGamePlaytime.timestampEnd))
    .limit(2)
    .all();
  const increased =
    !!lastRecord && playtimeMinutes > lastRecord.playtimeMinutes;
  const lastPlayedAt = increased ? now : null;
  let record;
  if (
    lastRecord?.playtimeMinutes === playtimeMinutes &&
    penultimateRecord?.playtimeMinutes === playtimeMinutes
  ) {
    console.log(`No new playtime for ${playedGame.name}`);
    record = db
      .update(epicGamePlaytime)
      .set({ timestampEnd: now })
      .where(eq(epicGamePlaytime.id, lastRecord.id))
      .returning()
      .get();
  } else {
    record = db
      .insert(epicGamePlaytime)
      .values({
        epicId: playedGame.epicId,
        timestampStart: lastRecord ? lastRecord.timestampEnd : undefined,
        timestampEnd: now,
        playtimeMinutes,
        lastPlayedAt,
      })
      .returning()
      .get();
    console.log(`Recorded playtime for ${playedGame.name}`);
  }
  db.update(epicGame)
    .set({ playtimeMinutes, ...(increased ? { lastPlayedAt } : {}) })
    .where(eq(epicGame.epicId, playedGame.epicId))
    .run();
  await refreshGameAggregates(playedGame.gameId);
  return record;
}

export async function recordEpicPlaytimes() {
  const currentUser = await getEpicUser();
  if (!currentUser) {
    return;
  }
  const user = await handleRefreshToken(currentUser);
  const { data: playtimes, error } = await tryCatch(
    getEpicPlaytimes(user.accountId, user.accessToken),
  );
  if (error || !playtimes) {
    console.error(`Failed to fetch Epic playtimes: ${error}`);
    return;
  }
  const totalTimeByArtifactId = new Map(
    playtimes.map((entry) => [entry.artifactId, entry.totalTime]),
  );
  const epicGames = db.select().from(epicGame).all();
  const now = new Date();
  for (const playedGame of epicGames) {
    await recordEpicPlaytime(
      playedGame,
      totalTimeByArtifactId.get(playedGame.appName) ?? 0,
      now,
    );
  }
}

export async function getEpicPlaytimeRecords(epicId: number) {
  return db
    .select()
    .from(epicGamePlaytime)
    .where(eq(epicGamePlaytime.epicId, epicId))
    .all();
}
