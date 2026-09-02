---
type: task
status: done
---

# Art caching for all providers

Written 2026-08-31 against `158aaf0`.

## Goal

One art cache covering Steam, GOG and Epic, serving images at sizes close to what the UI renders. Today only Steam is cached; GOG and Epic hotlink their CDNs at original resolution, and the library list/poster views load hundreds of oversized images.

## Current state

### Steam (cached)

- `server/providers/steam/art.ts` `getSteamArtUrls(appId)` derives 7 CDN URLs by convention. `server/steam/art.ts` fetches them to `data/art/steam/<appId>/<type>.jpg`; `server/routes/art/steam/[appId]/[type].ts` streams them with `Cache-Control: public, max-age=3600`. Icon is separate (`server/steam/icon.ts`, needs `imgIconUrl` hash from DB).
- Trigger: manual `cacheSteamArt` task only (tasks page button); not scheduled, not fired after sync.
- On disk: 615 games × 8 files ≈ 415 MB (~675 KB/game). `hero.jpg` (~390 KB) and `poster.jpg` (`library_600x900_2x`, 1200×1800, ~260 KB) dominate; neither is ever shown near full size.

Defects in the existing cache:

1. `cacheArt` writes whatever `fetch` returns — no status/content-type check. Steam 404 bodies are cached as art (confirmed: `data/art/steam/1012560/background.jpg` is 146 bytes).
2. `isSteamArtCached` returns true if _any one_ of the 7 files exists → partial/failed runs never retried. No TTL, no invalidation, no delete path.
3. Everything is written as `.jpg` including `logo.png`.

### GOG (hotlinked, resize broken)

- 6 URL columns on `GogGame` (`server/database/schema.ts:178-183`), from `_links` in the detail API.
- `shared/art.ts` `resolveGogImageUrl` expects templated `…_{formatter}.{ext}` URLs and substitutes presets (`glx_logo_2x` etc). **All 22 stored rows are plain `https://images.gog-statics.com/<hash>.png|jpg` — no template, so the formatter never applies and full-size originals are served.** Already flagged unverified in [09](09-GOG-Playtime.md).
- The CDN does support presets on hash URLs via suffix (`<hash>_<preset>.<ext>`); the URL must be reconstructed, not string-replaced.

### Epic (hotlinked, grossly oversized)

- 3 URL columns (`server/database/schema.ts:240-242`) picked from `keyImages[]`. Typical: tall 860×1148–1200×1600, wide 2560×1440 (one at 4267×2400). Multi-hundred-KB JPEGs.
- `getEpicIconUrl` returns `boxArtTallUrl` unmodified → a 1200×1600 JPEG rendered at 32×32 in every `GameRow`. Worst offender in the app.
- `cdn1.epicgames.com` honours `?w=&h=&resize=1` (Heroic/Legendary use this); we never append it.

### Consumers

- Poster wall (`GamePoster.vue`, grid on `games.vue`/`index.vue`): ~220 CSS px wide, `aspect-[3/4]`, `loading="lazy"`, no `width`/`height`/`sizes`.
- List rows (`GameRow.vue` → `GameIcon.vue`): 32×32 CSS px.
- Hero (`ArtHero.vue`): full-res art behind `blur-xl brightness-50` — resolution wasted by the blur.
- Provider dispatch centralised in `shared/art.ts` `getGameArtUrls` (Steam row wins, then GOG, then Epic).

No image library installed (no sharp/ipx/@nuxt/image). Nitro tasks + SSE queue already exist.

## Design

### Principle: cache generously

Self-hosted inverts normal cache wisdom: server↔client link is LAN-fast, so oversized cached art only costs client CPU to rescale. Prefer caching at native/largest size over chasing minimal bytes. Downsize at fetch only where the original is absurd for the slot (Epic 1200×1600 as a 32px icon). Steam libraries will dominate, and Steam gives the richest art — take all of it.

### 1. Canonical art types

Generalised vocabulary, mapped per provider. A provider lacking a type 404s and `getGameArtUrls` falls back.

| Type         | Shape / use                        | Steam                                   | GOG                                               | Epic                                          |
| ------------ | ---------------------------------- | --------------------------------------- | ------------------------------------------------- | --------------------------------------------- |
| `icon`       | small square; list rows            | community icon via `imgIconUrl` (~32px) | `iconSquareUrl ?? iconUrl` + `glx_square_icon_v2` | derived: tall box, cropped square server-side |
| `poster`     | tall box (2:3); poster wall        | `library_600x900_2x.jpg` (1200×1800)    | `boxArtImageUrl`                                  | `boxArtTallUrl` (DieselGameBoxTall)           |
| `hero`       | wide banner; game page top         | `library_hero.jpg` (up to 3840×1240)    | `backgroundImageUrl`                              | `boxArtWideUrl` (2560×1440)                   |
| `background` | full-page backdrop (shown blurred) | `page_bg_generated_v6b.jpg`             | `galaxyBackgroundImageUrl ?? backgroundImageUrl`  | `boxArtWideUrl`                               |
| `logo`       | transparent wordmark; over hero    | `logo.png`                              | `logoUrl` + `glx_logo_2x`                         | `logoUrl` (DieselGameBoxLogo, often null)     |

Notes:

- Keep the full Steam type set including `_2x` poster and generated backgrounds — they'll be the majority of libraries and the extra bytes are acceptable per the principle above.
- Epic `hero`/`background` share one source URL; cache once, alias the type (same file, two route types resolving to one key — or just fetch twice, it's simple and cheap).
- GOG presets still need fixing (hash-URL reconstruction) even under "cache generously". Verified live: `glx_icon_square` does not exist — the working square-icon preset is `glx_square_icon_v2` (112×112); `glx_logo_2x` works on hash URLs. Native GOG icons are already 128×128, so the icon preset is a mild downsize rather than a crop.

### 2. Generalise the cache key

`data/art/<provider>/<id>/<type>.<ext>` with `provider ∈ steam|gog|epic`. Steam keeps convention-derived URLs; GOG/Epic resolve URLs from their DB rows. One route `GET /art/:provider/:id/:type` (zod per-provider id + type enums) replaces the Steam-only route; keep the old path as alias or migrate the two callers.

**Who chooses the provider: the client.** The route stays provider-specific; `getGameArtUrls(game)` (shared, already the single authority) picks the provider per type from the rows the client already holds (Steam → GOG → Epic). Not a game-level `/art/game/:id/:type` with server-side choice: that adds a DB lookup per image request, and a stable game-keyed URL serves stale browser-cached art after a merge or a new provider link, whereas a provider URL changes and refetches naturally. If per-type fallback on missing art is wanted later (Steam poster 404 → GOG), extend `getGameArtUrls` to rank by present URL columns rather than moving choice server-side.

### 3. Fetch on miss, blocking

Route handler: file exists → stream; else fetch from CDN, validate, write, stream. Miss-fetch blocks the response — only the first load of a game's art is permitted to be slow. This also fixes the current Steam fault where art doesn't exist until someone presses the task button. Keep a prefetch task (`cacheArt`, all providers) for warming after sync. Guard concurrent fetches of the same key with an in-flight map; reuse the existing rate limiter per provider host.

Fetch validation (fixes defect 1): require `res.ok` and `content-type: image/*`; on failure write nothing and return 502. Derive extension from content-type (fixes 3).

### 4. Sizing: native sizes, plus sharp for derived assets

Add **sharp** as the server image library: it's the engine under `@nuxt/image`/ipx, runs fine in Nitro routes, and prebuilt Linux binaries mean no Dockerfile compile step (unlike better-sqlite3). Chosen over jimp (slow, weak WebP) and ipx (URL-transform layer we don't need when we control both ends). Used now for one job, kept for later resize/WebP-optimised responses.

- Epic `icon`: no native source — fetch tall box once, sharp centre-crop square + resize to ~128px at cache-fill time, store as the `icon` file.
- GOG presets still applied where they change shape (`glx_square_icon_v2`) or are the intended asset (`glx_logo_2x`).

Everything else fetches and stores at native size per the cache-generously principle. Transform happens at cache-fill, not per-request — the serving path stays a plain file stream.

### 5. Front-end hygiene

- Add `width`/`height` attrs (or aspect classes already give layout stability — verify no CLS) and `sizes` to `GamePoster` img.
- `GameIcon`/`GamePoster`/`ArtHero` all point at `/art/...` routes regardless of provider; browser cache header can rise to `max-age=86400`.

### 6. Invalidation: separate follow-up task

Out of scope here; a stale cache **must not** slow app usage — only first load may be slow, so refresh is background-only (mtime-based TTL, refetch via the task queue, serve stale meanwhile). This task ships with: per-file existence checks (fixes defect 2, prefetch task retries gaps), and existing cache treated as disposable (`rm -r data/art`, lazy refill — no migration).

## Plan

1. Fix `resolveGogImageUrl` for hash URLs + verify presets live. Unit tests with real stored URL shapes (fixtures currently use `faker.internet.url()` — tighten).
2. Add sharp; Epic icon derivation (crop square, ~128px) at cache-fill; confirm it survives the Docker build/runtime split.
3. Generalise `server/steam/art.ts` → `server/art/` (canonical types, path builder, validated fetch, per-provider URL resolvers, rate limit per host).
4. New route `GET /art/:provider/:id/:type` with blocking fetch-on-miss; port e2e tests; migrate `shared/art.ts` consumers; drop/alias the Steam-only route.
5. Replace `cacheSteamArt` task with `cacheArt` (all providers, per-file retry).
6. Front-end: `GameIcon`/`GamePoster`/`ArtHero` src via new route; `sizes`/dimensions attrs.
7. Follow-up doc/task: TTL invalidation + background refetch.

## Unanswered questions

None outstanding.

## Outcome

Implemented 2026-08-31, commits `c088dcb`…`a3730ee`. Delivered as specced with these deviations:

- GOG icon preset corrected live: `glx_square_icon_v2` (the doc's original `glx_icon_square` does not exist on the CDN).
- Upstream 403 treated as not-found (Steam's CDN 403s on missing assets), not 502.
- Serving now sets `Content-Type` from the file extension; extension probing (`<type>.{jpg,png,webp,gif,avif}`) keeps the legacy all-`.jpg` Steam cache working with no migration; a refetch landing on a new extension deletes stale siblings.
- Misses are not negative-cached — a game genuinely lacking a type re-hits the CDN per request (accepted v1 trade-off; revisit with the invalidation follow-up).
- `server/art/` module: types, paths, validated fetch (temp-write + rename), per-provider source resolvers, epic icon derivation (sharp, 128px webp), per-host rate limit (bulk task only), `ensureArtCached` with in-flight map.
- Browser `Cache-Control` left at `max-age=3600`; raising it belongs with the invalidation follow-up ([plan](#plan) step 7, still open).
