import SteamUser from "steam-user";
import type {
  NewSteamPicsMetadata,
  SteamAssociation,
  SteamLogoPosition,
} from "~~/server/database/schema";
import { SteamServiceError } from "./service";

// The only module importing steam-user: PICS needs a full Steam client session,
// so the dependency stays behind this boundary.

export type PicsAppData = Omit<NewSteamPicsMetadata, "appId" | "fetchedAt">;

const SESSION_TIMEOUT_MS = 60_000;

// appinfo is binary VDF: every scalar arrives as a string.
function asText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asInteger(value: unknown): number | null {
  const text = asText(value) ?? (typeof value === "number" ? value : null);
  if (text === null) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function asNumber(value: unknown): number | null {
  const text = asText(value) ?? (typeof value === "number" ? value : null);
  if (text === null) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function asEpochSecondsDate(value: unknown): Date | null {
  const seconds = asInteger(value);
  return seconds === null ? null : new Date(seconds * 1000);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

// Lists arrive as objects keyed "0", "1", … — their order is the store's order.
function orderedEntries(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record)
    .map(([key, entry]) => [Number(key), entry] as const)
    .filter(([index]) => Number.isFinite(index))
    .sort(([a], [b]) => a - b)
    .map(([, entry]) => entry);
}

function assetPaths(
  libraryAssets: Record<string, unknown> | null,
  key: string,
): { path: string | null; path2x: string | null } {
  const asset = asRecord(libraryAssets?.[key]);
  return {
    path: asText(asRecord(asset?.image)?.english),
    path2x: asText(asRecord(asset?.image2x)?.english),
  };
}

function logoPositionOf(
  libraryAssets: Record<string, unknown> | null,
): SteamLogoPosition | null {
  const position = asRecord(
    asRecord(libraryAssets?.library_logo)?.logo_position,
  );
  if (!position) return null;
  const pinnedPosition = asText(position.pinned_position);
  const widthPct = asNumber(position.width_pct);
  const heightPct = asNumber(position.height_pct);
  if (pinnedPosition === null || widthPct === null || heightPct === null) {
    return null;
  }
  return { pinnedPosition, widthPct, heightPct };
}

function storeTagsOf(common: Record<string, unknown>): number[] | null {
  const tagIds = orderedEntries(common.store_tags)
    .map(asInteger)
    .filter((tagId): tagId is number => tagId !== null);
  return tagIds.length > 0 ? tagIds : null;
}

function associationsOf(
  common: Record<string, unknown>,
): SteamAssociation[] | null {
  const associations = orderedEntries(common.associations)
    .map((entry) => {
      const association = asRecord(entry);
      const type = asText(association?.type);
      const name = asText(association?.name);
      return type !== null && name !== null ? { type, name } : null;
    })
    .filter(
      (association): association is SteamAssociation => association !== null,
    );
  return associations.length > 0 ? associations : null;
}

function mapCommon(
  common: Record<string, unknown>,
  changenumber: number | null,
): PicsAppData {
  const libraryAssets = asRecord(common.library_assets_full);
  const capsule = assetPaths(libraryAssets, "library_capsule");
  const hero = assetPaths(libraryAssets, "library_hero");
  const heroBlur = assetPaths(libraryAssets, "library_hero_blur");
  const logo = assetPaths(libraryAssets, "library_logo");
  const header = assetPaths(libraryAssets, "library_header");
  const deck = asRecord(common.steam_deck_compatibility);

  return {
    changenumber,
    capsulePath: capsule.path,
    capsule2xPath: capsule.path2x,
    heroPath: hero.path,
    hero2xPath: hero.path2x,
    heroBlurPath: heroBlur.path,
    logoPath: logo.path,
    logo2xPath: logo.path2x,
    headerPath: header.path,
    header2xPath: header.path2x,
    logoPosition: logoPositionOf(libraryAssets),
    iconHash: asText(common.icon),
    reviewScore: asInteger(common.review_score),
    reviewPercentage: asInteger(common.review_percentage),
    deckCompatibility: asInteger(deck?.category),
    steamosCompatibility: asInteger(deck?.steamos_compatibility),
    steamMachineCompatibility: asInteger(deck?.steam_machine_compatibility),
    storeTags: storeTagsOf(common),
    associations: associationsOf(common),
    steamReleaseDate: asEpochSecondsDate(common.steam_release_date),
    originalReleaseDate: asEpochSecondsDate(common.original_release_date),
    nameLocalized: asRecord(common.name_localized) as Record<
      string,
      string
    > | null,
    supportedLanguages: asRecord(common.supported_languages),
    osList: asText(common.oslist),
    controllerSupport: asText(common.controller_support),
  };
}

export async function getPicsMetadata(
  appIds: number[],
): Promise<Map<number, PicsAppData>> {
  if (appIds.length === 0) return new Map();

  const client = new SteamUser();

  return new Promise<Map<number, PicsAppData>>((resolve, reject) => {
    let settled = false;
    const settle = (outcome: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        client.logOff();
      } catch {
        // A failed session may have no connection left to close.
      }
      outcome();
    };

    const timer = setTimeout(
      () =>
        settle(() =>
          reject(
            new SteamServiceError(
              `Steam PICS session timed out after ${SESSION_TIMEOUT_MS}ms`,
            ),
          ),
        ),
      SESSION_TIMEOUT_MS,
    );

    client.on("error", (error) =>
      settle(() =>
        reject(new SteamServiceError(`Steam PICS session failed: ${error}`)),
      ),
    );

    client.on("loggedOn", () => {
      client.getProductInfo(appIds, [], true).then(
        (result) => {
          const metadata = new Map<number, PicsAppData>();
          for (const appId of appIds) {
            const app = result.apps?.[String(appId)];
            const common = asRecord(app?.appinfo?.common);
            if (!common) continue;
            metadata.set(appId, mapCommon(common, app?.changenumber ?? null));
          }
          settle(() => resolve(metadata));
        },
        (error) =>
          settle(() =>
            reject(
              new SteamServiceError(
                `Steam PICS appinfo request failed: ${error}`,
              ),
            ),
          ),
      );
    });

    client.logOn({ anonymous: true });
  });
}
