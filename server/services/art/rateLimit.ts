import sleep from "#shared/utils/sleep";

const ART_FETCH_PER_MINUTE = 600;
const TIME_PER_ART_FETCH = 60_000 / ART_FETCH_PER_MINUTE;

const nextFetchAllowedAtByHost = new Map<string, number>();

// Bulk callers space their fetches out per CDN host; a single on-miss fetch
// from the art route never waits.
export async function waitForArtFetchSlot(url: string) {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return;
  }
  const now = Date.now();
  const nextAllowedAt = nextFetchAllowedAtByHost.get(host) ?? 0;
  nextFetchAllowedAtByHost.set(
    host,
    Math.max(now, nextAllowedAt) + TIME_PER_ART_FETCH,
  );
  const timeToWait = nextAllowedAt - now;
  if (timeToWait > 0) {
    await sleep(timeToWait);
  }
}
