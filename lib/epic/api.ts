import { z } from "zod";
import { EPIC_CLIENT_ID } from "#shared/providers/epic";

export class EpicApiError extends Error {
  statusCode: number;
  retriable: boolean;

  constructor({
    message,
    statusCode,
    retriable = false,
  }: {
    message: string;
    statusCode: number;
    retriable?: boolean;
  }) {
    super(message);
    this.name = "EpicApiError";
    this.statusCode = statusCode;
    this.retriable = retriable;
  }
}

const NETWORK_ERROR_STATUS_CODE = 0;

function isRetriableStatusCode(statusCode: number): boolean {
  return statusCode === 429 || statusCode >= 500;
}

function createEpicApiError(
  response: Response,
  message?: string,
): EpicApiError {
  return new EpicApiError({
    message: message ?? response.statusText,
    statusCode: response.status,
    retriable: isRetriableStatusCode(response.status),
  });
}

const EPIC_CLIENT_SECRET = "daafbccc737745039dffe53d94fc76cf";
const EPIC_USER_AGENT =
  "UELauncher/11.0.1-14907503+++Portal+Release-Live Windows/10.0.19041.1.256.64bit";
const EPIC_STORE_USER_AGENT =
  "EpicGamesLauncher/11.0.1-14907503+++Portal+Release-Live";

const EPIC_OAUTH_HOST =
  "https://account-public-service-prod03.ol.epicgames.com";
const EPIC_CATALOG_HOST =
  "https://catalog-public-service-prod06.ol.epicgames.com";
const EPIC_LIBRARY_HOST = "https://library-service.live.use1a.on.epicgames.com";
const EPIC_STORE_GRAPHQL_URL = "https://launcher.store.epicgames.com/graphql";
const EPIC_STORE_CONTENT_HOST = "https://store-content.ak.epicgames.com";

async function epicFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", EPIC_USER_AGENT);
  }
  try {
    return await fetch(url, { ...init, headers });
  } catch (error) {
    throw new EpicApiError({
      message: `Network request to ${url} failed: ${error}`,
      statusCode: NETWORK_ERROR_STATUS_CODE,
      retriable: true,
    });
  }
}

function bearer(accessToken: string) {
  return { Authorization: `bearer ${accessToken}` };
}

export { getEpicLoginUri } from "#shared/providers/epic";

const EpicTokenSchema = z
  .object({
    access_token: z.string(),
    expires_in: z.number(),
    expires_at: z.string().optional(),
    refresh_token: z.string(),
    refresh_expires: z.number().optional(),
    refresh_expires_at: z.string().optional(),
    account_id: z.string(),
    displayName: z.string().optional(),
    client_id: z.string().optional(),
  })
  .passthrough();

export type EpicToken = z.infer<typeof EpicTokenSchema>;

const EpicErrorBodySchema = z
  .object({
    errorCode: z.string().optional(),
    errorMessage: z.string().optional(),
    continuationUrl: z.string().optional(),
  })
  .passthrough();

function epicErrorMessage(response: Response, body: unknown): string {
  const parsed = EpicErrorBodySchema.safeParse(body);
  if (!parsed.success) return response.statusText;
  const { errorCode, errorMessage } = parsed.data;
  if (!errorCode && !errorMessage) return response.statusText;
  return [errorCode, errorMessage].filter(Boolean).join(": ");
}

async function requestEpicToken(
  body: Record<string, string>,
): Promise<EpicToken> {
  const credentials = Buffer.from(
    `${EPIC_CLIENT_ID}:${EPIC_CLIENT_SECRET}`,
  ).toString("base64");
  const response = await epicFetch(
    `${EPIC_OAUTH_HOST}/account/api/oauth/token`,
    {
      method: "POST",
      headers: {
        Authorization: `basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ ...body, token_type: "eg1" }).toString(),
    },
  );
  const data = await response.json();
  if (!response.ok) {
    throw createEpicApiError(response, epicErrorMessage(response, data));
  }
  return EpicTokenSchema.parse(data);
}

export async function getEpicToken(code: string): Promise<EpicToken> {
  return requestEpicToken({ grant_type: "authorization_code", code });
}

export async function refreshEpicToken(
  refreshToken: string,
): Promise<EpicToken> {
  return requestEpicToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

// The endpoint also returns email, name and lastLogin; we deliberately keep neither
const EpicAccountSchema = z
  .object({
    id: z.string(),
    displayName: z.string(),
    country: z.string().optional(),
  })
  .passthrough();

export type EpicAccount = {
  id: string;
  displayName: string;
  country?: string;
};

export async function getEpicAccount(
  accountId: string,
  accessToken: string,
): Promise<EpicAccount> {
  const response = await epicFetch(
    `${EPIC_OAUTH_HOST}/account/api/public/account/${accountId}`,
    { headers: bearer(accessToken) },
  );
  const data = await response.json();
  if (!response.ok) {
    throw createEpicApiError(response, epicErrorMessage(response, data));
  }
  const { id, displayName, country } = EpicAccountSchema.parse(data);
  return { id, displayName, country };
}

const EpicLibraryRecordSchema = z
  .object({
    namespace: z.string(),
    catalogItemId: z.string(),
    appName: z.string(),
    sandboxName: z.string().optional(),
    sandboxType: z.string().optional(),
    recordType: z.string().optional(),
    acquisitionDate: z.string().optional(),
    platform: z.array(z.string()).optional(),
  })
  .passthrough();

export type EpicLibraryRecord = z.infer<typeof EpicLibraryRecordSchema>;

const EpicLibraryPageSchema = z
  .object({
    records: z.array(EpicLibraryRecordSchema),
    responseMetadata: z
      .object({ nextCursor: z.string().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

export async function getEpicLibraryItems(
  accessToken: string,
): Promise<EpicLibraryRecord[]> {
  const records: EpicLibraryRecord[] = [];
  let cursor: string | undefined;
  do {
    const query = new URLSearchParams({ includeMetadata: "true" });
    if (cursor) query.set("cursor", cursor);
    const response = await epicFetch(
      `${EPIC_LIBRARY_HOST}/library/api/public/items?${query.toString()}`,
      { headers: bearer(accessToken) },
    );
    const data = await response.json();
    if (!response.ok) {
      throw createEpicApiError(response, epicErrorMessage(response, data));
    }
    const page = EpicLibraryPageSchema.parse(data);
    records.push(...page.records);
    cursor = page.responseMetadata?.nextCursor;
  } while (cursor);
  return records;
}

const EpicCatalogItemSchema = z
  .object({
    id: z.string(),
    namespace: z.string(),
    title: z.string(),
    description: z.string().optional(),
    developer: z.string().optional(),
    categories: z
      .array(z.object({ path: z.string() }).passthrough())
      .optional()
      .default([]),
    creationDate: z.string().optional(),
    releaseInfo: z
      .array(
        z
          .object({
            appId: z.string().optional(),
            platform: z.array(z.string()).optional().default([]),
            compatibleApps: z.array(z.string()).optional(),
          })
          .passthrough(),
      )
      .optional()
      .default([]),
    customAttributes: z
      .record(
        z
          .object({ type: z.string().optional(), value: z.string().optional() })
          .passthrough(),
      )
      .optional(),
    mainGameItem: z.object({ id: z.string() }).passthrough().optional(),
    keyImages: z
      .array(
        z
          .object({
            type: z.string(),
            url: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
          })
          .passthrough(),
      )
      .optional()
      .default([]),
    entitlementType: z.string().optional(),
  })
  .passthrough();

export type EpicCatalogItem = z.infer<typeof EpicCatalogItemSchema>;

const EpicCatalogResponseSchema = z.record(EpicCatalogItemSchema);

const CATALOG_BATCH_SIZE = 50;

export async function getEpicCatalogItems(
  namespace: string,
  catalogItemIds: string[],
  accessToken: string,
): Promise<Record<string, EpicCatalogItem>> {
  const items: Record<string, EpicCatalogItem> = {};
  for (
    let start = 0;
    start < catalogItemIds.length;
    start += CATALOG_BATCH_SIZE
  ) {
    const batch = catalogItemIds.slice(start, start + CATALOG_BATCH_SIZE);
    const query = new URLSearchParams({
      includeDLCDetails: "true",
      includeMainGameDetails: "true",
      country: "GB",
      locale: "en-GB",
    });
    for (const id of batch) query.append("id", id);
    const response = await epicFetch(
      `${EPIC_CATALOG_HOST}/catalog/api/shared/namespace/${namespace}/bulk/items?${query.toString()}`,
      { headers: bearer(accessToken) },
    );
    const data = await response.json();
    if (!response.ok) {
      throw createEpicApiError(response, epicErrorMessage(response, data));
    }
    Object.assign(items, EpicCatalogResponseSchema.parse(data));
  }
  return items;
}

const EpicStoreSlugSchema = z.object({
  data: z.object({
    Catalog: z.object({
      catalogNs: z
        .object({
          mappings: z
            .array(z.object({ pageSlug: z.string() }).passthrough())
            .nullable()
            .optional(),
        })
        .nullable(),
    }),
  }),
});

const STORE_SLUG_QUERY =
  'query($ns:String!){Catalog{catalogNs(namespace:$ns){mappings(pageType:"productHome"){pageSlug}}}}';

export async function getEpicStoreSlug(
  namespace: string,
): Promise<string | null> {
  try {
    const response = await epicFetch(EPIC_STORE_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": EPIC_STORE_USER_AGENT,
      },
      body: JSON.stringify({
        query: STORE_SLUG_QUERY,
        variables: { ns: namespace },
      }),
    });
    if (!response.ok) {
      throw createEpicApiError(response);
    }
    const parsed = EpicStoreSlugSchema.parse(await response.json());
    return parsed.data.Catalog.catalogNs?.mappings?.[0]?.pageSlug ?? null;
  } catch (error) {
    console.error(
      `Failed to look up Epic store slug for ${namespace}: ${error}`,
    );
    return null;
  }
}

const EpicStoreContentSchema = z.object({
  pages: z
    .array(
      z
        .object({
          type: z.string().optional(),
          data: z
            .object({
              meta: z
                .object({
                  releaseDate: z.string().nullish(),
                  developer: z.array(z.string()).nullish(),
                  publisher: z.array(z.string()).nullish(),
                })
                .passthrough()
                .optional(),
              about: z
                .object({ shortDescription: z.string().nullish() })
                .passthrough()
                .optional(),
            })
            .passthrough()
            .optional(),
        })
        .passthrough(),
    )
    .optional()
    .default([]),
});

export type EpicStoreContent = {
  releaseDate: string | null;
  developer: string[] | null;
  publisher: string[] | null;
  shortDescription: string | null;
};

export async function getEpicStoreContent(
  slug: string,
): Promise<EpicStoreContent | null> {
  try {
    const response = await epicFetch(
      `${EPIC_STORE_CONTENT_HOST}/api/en-GB/content/products/${slug}`,
    );
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw createEpicApiError(response);
    }
    const parsed = EpicStoreContentSchema.parse(await response.json());
    const page =
      parsed.pages.find((candidate) => candidate.type === "productHome") ??
      parsed.pages[0];
    return {
      releaseDate: page?.data?.meta?.releaseDate ?? null,
      developer: page?.data?.meta?.developer ?? null,
      publisher: page?.data?.meta?.publisher ?? null,
      shortDescription: page?.data?.about?.shortDescription ?? null,
    };
  } catch (error) {
    console.error(`Failed to fetch Epic store content for ${slug}: ${error}`);
    return null;
  }
}

// totalTime is seconds; the service converts to minutes at this boundary
const EpicPlaytimeSchema = z
  .object({
    artifactId: z.string(),
    totalTime: z.number(),
  })
  .passthrough();

export type EpicPlaytime = z.infer<typeof EpicPlaytimeSchema>;

export async function getEpicPlaytimes(
  accountId: string,
  accessToken: string,
): Promise<EpicPlaytime[]> {
  const response = await epicFetch(
    `${EPIC_LIBRARY_HOST}/library/api/public/playtime/account/${accountId}/all`,
    { headers: bearer(accessToken) },
  );
  const data = await response.json();
  if (!response.ok) {
    throw createEpicApiError(response, epicErrorMessage(response, data));
  }
  return z.array(EpicPlaytimeSchema).parse(data);
}
