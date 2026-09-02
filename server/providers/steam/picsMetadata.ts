import { db } from "~~/server/database/client";
import {
  type SteamPicsMetadata,
  steamGame,
  steamPicsMetadata,
  steamTag,
} from "~~/server/database/schema";
import { getTagList } from "./api";
import { getPicsMetadata, type PicsAppData } from "./pics";

// Columns art resolution reads: a change to any of them invalidates the cached
// files and `.missing` markers for that app. Metadata-only changes do not.
const ASSET_COLUMNS = [
  "capsulePath",
  "capsule2xPath",
  "heroPath",
  "hero2xPath",
  "heroBlurPath",
  "logoPath",
  "logo2xPath",
  "headerPath",
  "header2xPath",
  "iconHash",
] as const satisfies readonly (keyof PicsAppData)[];

export interface PicsMetadataUpdate {
  appIdsFetched: number[];
  appIdsWithChangedArt: number[];
  tagCount: number;
}

function hasAnyAsset(data: PicsAppData): boolean {
  return ASSET_COLUMNS.some((column) => data[column] !== null);
}

function assetsChanged(
  previous: SteamPicsMetadata | undefined,
  next: PicsAppData,
): boolean {
  // A first fetch invalidates too: the legacy chain may have cached art or
  // stale `.missing` markers that the PICS paths supersede.
  if (!previous) return hasAnyAsset(next);
  return ASSET_COLUMNS.some(
    (column) => previous[column] !== (next[column] ?? null),
  );
}

export async function updatePicsMetadata(
  onProgress?: (message: string) => void | Promise<void>,
): Promise<PicsMetadataUpdate> {
  const appIds = db
    .select({ appId: steamGame.appId })
    .from(steamGame)
    .all()
    .map((row) => row.appId);

  const metadata = await getPicsMetadata(appIds);
  await onProgress?.(`Fetched PICS metadata for ${metadata.size} apps`);

  const existingByAppId = new Map(
    db
      .select()
      .from(steamPicsMetadata)
      .all()
      .map((row) => [row.appId, row]),
  );

  const fetchedAt = new Date();
  const appIdsWithChangedArt: number[] = [];

  db.transaction((tx) => {
    for (const [appId, data] of metadata) {
      if (assetsChanged(existingByAppId.get(appId), data)) {
        appIdsWithChangedArt.push(appId);
      }
      tx.insert(steamPicsMetadata)
        .values({ appId, fetchedAt, ...data })
        .onConflictDoUpdate({
          target: steamPicsMetadata.appId,
          set: { fetchedAt, ...data },
        })
        .run();
    }
  });
  await onProgress?.(`Stored PICS metadata for ${metadata.size} apps`);

  const tags = await getTagList();
  db.transaction((tx) => {
    for (const tag of tags) {
      tx.insert(steamTag)
        .values({ tagId: tag.tagid, name: tag.name })
        .onConflictDoUpdate({
          target: steamTag.tagId,
          set: { name: tag.name },
        })
        .run();
    }
  });

  return {
    appIdsFetched: [...metadata.keys()],
    appIdsWithChangedArt,
    tagCount: tags.length,
  };
}
