---
type: task
status: done
---

# Art misses and poster fallbacks

Written 2026-08-31 against `22aa5f8`. Follow-up to [14](14-Art-Caching.md).

## Problem

- Misses are not negative-cached: every render of a game whose art genuinely doesn't exist (e.g. Steam 201870 has no `library_600x900` on any CDN host) re-hits the CDN, blocking that image slot on every poster-wall load.
- Games without library art show the icon-tile fallback in `GamePoster` — bare for a poster wall.

## Design

### 1. Negative caching of upstream misses

- When the CDN says the asset doesn't exist (404/403), write an empty marker file `data/art/<provider>/<id>/<type>.missing` alongside where the art would live.
- `ensureArtCached`: a marker younger than 7 days (mtime) → throw `ArtSourceNotFoundError` without touching the network; older → delete marker and retry the fetch. A successful fetch deletes any marker.
- No marker for null-source cases (GOG/Epic column empty, no DB row) — those already 404 without a network hit.
- The route's 404 response gains `Cache-Control: public, max-age=3600` so browsers stop re-requesting per render too.
- `cacheArt` bulk task: fresh marker counts as done (skip silently).

### 2. Steam poster fallback chain (server-side)

Source resolution becomes an ordered candidate list; the fetch tries each until one succeeds, caches the winner under the requested type:

- steam `poster`: `library_600x900_2x.jpg` → `library_600x900.jpg` → `header.jpg` (capsule, 460×215 — crops hard in a 3:4 slot via `object-cover`, but beats nothing per taste; the placeholder below is the true last resort).
- All other types stay single-candidate. The `.missing` marker is written only when every candidate misses.

GOG/Epic need no chain — their sources come from DB columns the client already ranks.

### 3. HTML placeholder poster (client-side, ultimate fallback)

When `getGameArtUrls` yields no poster URL, or the poster request 404s (`@error` on the img), `GamePoster` renders a generated placeholder instead of the icon tile:

- New component `PosterPlaceholder.vue`: fills the existing 3:4 box; background colour derived deterministically from the game name — hash → hue, fixed saturation/lightness tuned to sit with the app's muted palette (not neon; think dark desaturated tones with the title readable on top). Same hue in light and dark mode, lightness may differ.
- Title set large in the display font (Archivo), wrapped, clamped; a subtle darker gradient at the bottom is fine. No icons, no borders beyond what `GamePoster` already draws.
- Colour derivation lives in `shared/` (pure, unit-testable): `getPlaceholderColour(name)` or similar returning HSL parts.
- `GameIcon`'s existing `UAvatar` fallback stays as-is.

## Plan

1. Server: `.missing` markers + 7-day retry + 404 `Cache-Control` + steam poster candidate chain + bulk-task skip; unit/e2e tests (no real network).
2. Client: `PosterPlaceholder.vue`, colour util + tests, `GamePoster` wiring (null poster and `@error`).

Both independent — parallel.

## Unanswered questions

None.

## Outcome

Implemented 2026-08-31, commits `53502d6`…`a18b52c`. As specced, with notes:

- `ArtNegativelyCachedError extends ArtSourceNotFoundError`, so existing 404 handling covers it; the marker check runs before the in-flight map, and one marker covers a whole candidate chain. `ArtFetchError` (network/5xx/non-image) never writes a marker.
- The steam poster chain is built from `getSteamArtUrls` keys — `server/providers/steam/art.ts` and the debug page untouched.
- Placeholder colour: FNV-1a hash of name → hue, s 34% / l 30%, same in both modes; title `font-display` semibold, `line-clamp-4`, `to-black/40` bottom gradient.
- Also purged 628 poisoned 146-byte HTML "art" files from `data/art/steam` (written by the pre-14 fetcher); fetch-on-miss refills honestly.
