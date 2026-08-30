---
type: task
status: done
---

# Merge games

Rewritten 2026-08-30; supersedes the earlier "link across providers" sketch.

## Problem

`createGame` in both provider services always creates a new `Game`, so one title can appear as several `Game` rows with independent `state`, playtime and history. Two cases:

1. Same game, different providers — Steam and GOG copies of one title.
2. Same game, same provider, different versions — GOG has two "The Witcher 3: Wild Hunt" products (617, 628; original and Complete Edition, both now renamed to Complete Edition), each with playtime.

Case 2 is the one that shapes the design: a `Game` must own **many** rows of the **same** provider. `SteamGame_gameId_key`/`GogGame_gameId_key` unique indexes currently forbid that.

## Design

Provider rows (`SteamGame`, `GogGame` and their playtime/appinfo tables) are the source of truth and are never merged, deleted or rewritten. `Game` is the agnostic layer; merging only re-points provider rows' `gameId`. That makes merges cheap, sync-safe (sync keys on `appId`/`gogId`, never on `Game`) and reversible (split = re-point one provider row to a fresh `Game`).

Provider row `gameId` becomes 1:N. `Game.state`/history stays per `Game`. Aggregates sum over all provider rows.

No match-suggestion or auto-merge in this task; manual only. Suggestion pass (normalised name, gamesdb Steam id) is a follow-up.

## Schema

- Drop unique indexes `SteamGame_gameId_key`, `GogGame_gameId_key`; replace with plain indexes.
- Relations: `game.steamGames: many(steamGame)`, `game.gogGames: many(gogGame)` — rename from singular so every consumer breaks at typecheck and gets fixed.
- No audit table. Merge is reversible via split; nothing to record. `GameStateChange` rows of merged-away `Game`s move to the target so history survives.

Migration: drizzle generate → one SQL file (index drop/recreate). No data migration.

## `lib/games.ts`

```ts
mergeGames(targetId: number, sourceIds: number[]): Promise<Game>
```

Transaction:

1. Reject if `sourceIds` contains `targetId`, or any id missing.
2. `UPDATE SteamGame/GogGame SET gameId = target WHERE gameId IN sources`.
3. `UPDATE GameStateChange SET gameId = target WHERE gameId IN sources`.
4. If `target.state IS NULL`, take the most recently changed non-null source state; append a `GameStateChange` for it so history is consistent.
5. `DELETE Game WHERE id IN sources`.
6. `refreshGameAggregates(target)`.

Target keeps its `name`. The UI picks direction, which is the user's way of choosing the surviving name.

```ts
splitGame(provider: "steam" | "gog", providerId: number): Promise<Game>
```

Transaction: refuse if the row's `Game` has only one provider row (no-op, return existing). Otherwise insert a new `Game` named from the provider row (`state` null, no history), re-point the provider row, refresh aggregates on both `Game`s.

Both exported through `server/trpc/routers/games.ts` as `mergeGames`, `splitGame` mutations.

## Provider sync changes

- `steam/service.ts updateGame`, `gog/service.ts` update path: currently copy the provider name onto `Game.name` every sync. With several provider rows this flip-flops. Only propagate when the `Game` has exactly one provider row across both providers. (Option: `Game.nameLocked` boolean set on merge — rejected, extra state for the same effect.)
- `refreshGameAggregates`: `playtimeMinutes = Σ steamGames.playtimeForever + Σ gogGames.playtimeMinutes`; `lastPlayedAt = max` across all rows. For Witcher 617+628 the sum is right: they are disjoint installs with disjoint playtime.

## Consumers to update (1:N)

- `lib/games.ts getGamePlaytimes`: iterate all rows; add `providerId` (appId/gogId) and provider row `name` to `GamePlaytimeRecord` so the table distinguishes 617 from 628.
- `lib/gameAggregates.ts` as above.
- `shared/art.ts getGameArtUrls`, `components/GameIcon.vue`, `pages/game/[id].vue` description, `pages/organise.vue`: first Steam row, else first GOG row. Deterministic order: `orderBy` primary key in the `with` clauses.
- `pages/game/[id].vue` play buttons: one "Open in"/"Play" pair per provider row, labelled with the provider row name when a `Game` has >1 row.
- `lib/fixtures/game.ts`, `test/db.ts`: no schema constraint change needed; add a fixture helper to attach a second provider row to an existing `Game`.
- Anything else `tsc` flags on `steamGame`/`gogGame` rename.

## UI

`pages/game/[id].vue`:

- "Merge into…" button → picker over `games` (client-side filter by name, excludes self). Confirm shows both names, provider rows, playtime, and states; states that would be lost are called out. On confirm: `mergeGames({ targetId: picked, sourceIds: [this] })`, navigate to target.
- Also offer the reverse ("Merge … into this") so the user can keep the current page's name/state without opening the other game.
- Provider rows section: each row lists provider, provider name, id, playtime; "Split" button (hidden when only one row) → `splitGame`, navigate to new `Game`.

No suggestions UI in this task.

## Tests

`lib/games.test.ts`:

- merge steam+gog → one `Game`, two rows, playtime summed, lastPlayed max, state/history moved, source deleted.
- merge gog+gog (Witcher case) → both `GogGame` rows on target, `getGamePlaytimes` returns both with distinct `providerId`.
- target state null + source state set → target adopts it with a `GameStateChange`.
- target state set → source state discarded.
- merge rejects self / unknown ids; nothing written on failure.
- split → new `Game`, aggregates recomputed on both; split on single-row `Game` is a no-op.
- provider `updateGame` no longer renames a `Game` with >1 row (steam and gog service tests).

## Steps

1. Schema + relations rename + migration; fix compile errors in consumers (art, icon, pages, playtimes, aggregates, fixtures).
2. Name-propagation guard in both provider services + tests.
3. `mergeGames`/`splitGame` + tests.
4. tRPC mutations.
5. Game page UI.

## Out of scope

- Match suggestions / auto-merge (follow-up task; recommend gamesdb Steam id first, normalised name second, never silent).
- Non-game DLC/packs (filtered at sync).
- Editing `Game.name` independently of providers (may fall out naturally later; not needed for merge).
