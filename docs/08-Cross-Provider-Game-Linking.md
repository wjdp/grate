---
type: task
status: todo
---

# Link the same game across providers

`createGame` in both provider services always creates a new `Game`. A title owned on Steam and GOG produces two `Game` rows with independent `state`, playtime and history. `Game.playtimeMinutes`/`lastPlayedAt` aggregates (added 2026-08-30) assume one `Game` can have both `steamGame` and `gogGame`, but nothing ever creates that shape.

## Options

1. Name match on create: normalise (lowercase, strip `™®:`, collapse whitespace, drop edition suffixes) and attach to an existing `Game` with no row for this provider. Cheap, wrong occasionally (remasters, "Game" vs "Game: Definitive Edition").
2. Manual link/unlink in the UI (`pages/game/[id].vue` → "Merge with…" picker) that moves the provider row's `gameId` and reruns `refreshGameAggregates`, merging `GameStateChange` history.
3. External id: GOG's `gamesdb.gog.com` exposes Steam ids for many titles (see `bruno/gog/get-gamesdb-game-details.bru`). Exact where available.

Recommend 3 where available, else 1 as a suggestion surfaced in the UI, with 2 as the override. Never auto-merge silently once a game has a state or playtime on both sides.

## Steps

1. Add `Game.mergedFromIds Json?` or a `GameMerge` audit table so merges are traceable.
2. `lib/games.ts`: `mergeGames(targetId, sourceId)` — moves provider rows, state changes; keeps the target's `state` unless null; deletes source; refreshes aggregates. Tests.
3. tRPC mutation + UI.
4. Suggestion pass: task that lists candidate pairs by normalised name / gamesdb id.

## Out of scope

Non-game DLC/packs; those are filtered at sync.
