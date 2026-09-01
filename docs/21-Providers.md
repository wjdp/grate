---
type: reference
---

# Providers

What a provider gives grate, how the three supported ones work, and which platforms could be added. Written 2026-08-31, after the provider job normalisation (doc 19).

## What a provider is

A provider supplies some subset of: account identity, an owned-games library, playtime, art and store metadata. Since doc 19 a provider is one entry in `PROVIDER_JOBS` (`lib/providerJobs.ts`) implementing:

- `isActive()` — is the account linked?
- `updateUser()` — refresh profile info.
- `updateGames(onProgress?)` — sync the library into `game` + provider-specific rows.
- `recordPlaytimes(onProgress?)` — capture playtime; returns `{ gamesCreated, unknownGames }` so the task layer can queue enrichment or a games sync. A provider with no playtime source returns zeroes.

Adding a provider means `lib/<provider>/` (api + service + tests), a `PROVIDER_JOBS` entry, a DB table for its rows, link/auth pages under `app/pages/providers/<provider>/`, and art sources in `server/art/`. The task, scheduling and sync-UI layers pick it up automatically.

## Supported

### Steam

- **Auth**: user-supplied Web API key + profile URL/id. No OAuth, key never expires.
- **Library**: `GetOwnedGames` — full library in one call, with per-platform playtime totals.
- **Playtime**: cumulative totals per game; recorder derives sessions from deltas between hourly ticks, and creates unknown games inline (new purchase played immediately).
- **Extras**: PICS metadata (library assets, tags), store API descriptions (`populateStoreData`), rich art.
- Richest provider by far; the model the others approximate.

### GOG

- **Auth**: authorization-code flow against GOG Galaxy's embedded client credentials; refresh tokens, refreshed on use.
- **Library**: owned product ids, then a per-game detail fetch each (slow, hence per-game progress). Unfetchable products (DLC, packs, delisted) are persisted in `gogIgnoredProduct` and skipped thereafter.
- **Playtime**: Galaxy `game_time` endpoint — cumulative minutes per game, sessions derived from deltas. Unknown ids in the feed (minus ignored) trigger a games sync. Last played inferred from deltas (doc 22).
- Descriptions are HTML, stripped at ingest.

### Epic

- **Auth**: authorization-code exchange (`eg1` token type, Launcher client credentials); refresh tokens.
- **Library**: launcher library items grouped by namespace, resolved against the catalogue; unresolvable items persisted in `epicIgnoredItem`.
- **Playtime**: playtime endpoint — cumulative seconds per artifact; same delta-session approach; unknown artifacts trigger a games sync. Last played inferred from deltas (doc 22).
- All of this is the reverse-engineered launcher API — stable for years (Legendary/Heroic depend on it) but unofficial.

## Could be added

Judged on API viability and what grate cares about (library + playtime). Effort assumes the doc-19 architecture.

| Provider         | Library                  | Playtime                                   | API                                                    | Effort     | Verdict                                         |
| ---------------- | ------------------------ | ------------------------------------------ | ------------------------------------------------------ | ---------- | ----------------------------------------------- |
| itch.io          | ✅ purchases             | ❌                                         | official, per-user API key                             | low        | **do first**                                    |
| PlayStation      | played titles            | ✅ per-title minutes                       | unofficial (`psn-api`, NPSSO token)                    | medium     | **strong** — best playtime source outside Steam |
| Xbox / Game Pass | title history            | ✅ minutes played                          | partner-only officially; OpenXBL or reverse-engineered | medium     | good, but Game Pass blurs owned vs access       |
| Amazon Games     | ✅ Prime freebies        | ❌                                         | reverse-engineered (Nile)                              | medium     | worthwhile for Prime hoarders                   |
| Humble Bundle    | ✅ purchases             | ❌                                         | unofficial                                             | low-medium | mostly Steam keys; DRM-free trove is the value  |
| EA App           | ❌ usable                | ❌                                         | none public, fragile RE                                | high       | skip                                            |
| Ubisoft Connect  | ❌ usable                | partial (club API, RE)                     | none public                                            | high       | skip                                            |
| Battle.net       | ❌ (no library endpoint) | ❌                                         | official APIs cover other data                         | —          | skip; tiny fixed catalogue                      |
| Nintendo Switch  | ❌                       | partial (parental-controls API, RE, flaky) | unofficial                                             | high       | skip for now                                    |

### Notes per candidate

- **itch.io** — `/my-owned-keys` style endpoints with a personal API key; auth UX is Steam-like (paste a key). Returns purchases with cover art and metadata. No playtime: `recordPlaytimes` returns zeroes and the runner just skips the enrichment path. The cheapest full test of the registry abstraction.
- **PlayStation** — NPSSO token copied from a logged-in browser session (comparable friction to the GOG flow), exchanged for access/refresh tokens. Per-title play duration comes from the title-stats endpoint. Console-only playtime, but that's the point: it extends grate beyond PC.
- **Xbox** — playtime and title history exist but "library" needs a concept of subscription access vs ownership (`owned | subscription` on the provider row) before Game Pass makes sense in the UI. Do PSN first; it forces fewer model changes.
- **Amazon / Humble** — library-only ingest; both would lean on the doc-16 duplicate matching since much of their content duplicates Steam/GOG entries.

### Manual provider

Not a platform, but the only integration that can never break: hand-entered games (physical, emulated, DRM-free installs, dead launchers), optional hand-logged or timer-based playtime. Fits the registry as a provider whose `updateGames`/`recordPlaytimes` are no-ops and whose rows are written by the UI instead. Worth its own design doc before any of the tier-two platforms.
