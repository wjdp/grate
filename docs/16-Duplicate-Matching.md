---
type: task
status: done
---

# Duplicate game matching

Follow-up to [08-Cross-Provider-Game-Linking](08-Cross-Provider-Game-Linking.md), which built manual `mergeGames`/`splitGame`. This adds the suggestion pass: find `Game` rows that are probably the same title, present them for review, merge on confirm, remember opt-outs.

## What the live db shows (dev.db, 2026-08-31)

876 `Game`, 615 Steam / 240 Epic / 22 GOG rows, 1 merged so far. A normalise + edition-strip pass finds **~44 duplicate groups**, almost all Steam↔Epic (Epic giveaways of owned Steam titles). Examples:

- Exact after normalisation: `Fallout: New Vegas`, `RUINER`/`RUINER`, `Prey`/`PREY`, `STAR WARS™: Squadrons`/`Star Wars Squadrons`, `Dishonored®: Death of the Outsider™ ` (trailing space) vs same without.
- Edition variants: `Dishonored`/`Dishonored - Definitive Edition`, `Metro 2033`/`Metro 2033 Redux`, `BioShock`/`BioShock Remastered`, `Tomb Raider`/`Tomb Raider GAME OF THE YEAR EDITION`, `Bad North: Jotunn Edition`/`Bad North Jotunn Edition`.
- One 3-way group: `Metro: Last Light Complete Edition` / `Metro: Last Light Redux` (both Steam) / `Metro Last Light Redux` (Epic).
- False-positive traps: sequels (`Portal`/`Portal 2`, `Civilization V`/`VI`), spin-offs (`Mirror's Edge`/`Catalyst`), and same-name-different-game (`Prey` 2006 vs 2017 — not in this library, but why we never auto-merge).

## Matching

All in TypeScript over in-memory names (876 rows, O(n²) trivial). No SQLite trigram extension, no persistence of suggestions — recomputed per request; only opt-outs persist.

`normaliseGameName(name)` in `shared/`:

1. Lowercase, trim; strip `™ ® ©`; punctuation (`:`,`-`, etc.) → space; collapse whitespace.
2. Strip edition vocabulary as trailing/embedded phrases: `game of the year edition`, `goty( edition)?`, `definitive edition`, `complete edition`, `enhanced edition`, trailing `enhanced`, `remastered`, `redux`, `director's cut`. Keep year disambiguators like `(2016)` — they distinguish real remakes.

**Single tier — identical normalised key only.** Catches all ~45 live groups (the trailing-`enhanced` rule adds `Grand Theft Auto V`/`Grand Theft Auto V Enhanced`, both Epic — a real within-provider pair).

Trigram tier 2 was tested against dev.db and rejected: Dice similarity ≥ 0.8 on normalised keys, even with a trailing-numeral sequel guard, yields 37 extra pairs of which only ~3 are real — the guard can't catch `Train Sim World® 2`/`3`, `Battlefield™ 1`/`V`, `Telltale Batman Season 1`/`2`, or mid-string numerals (`Fallout: A Post Nuclear…`/`Fallout 2: A Post Nuclear…`), and VR/demo/season variants (`SUPERHOT VR`, `The Stanley Parable Demo`, `The Walking Dead: Season One`) are distinct products at high similarity. The few genuine leftovers (`Saints Row IV`/`Saints Row IV Re-Elected`, `Death Stranding`/`Death Stranding Content`) stay manual merges via the game page's existing "Merge into…".

Pairs whose games already share a `Game.id` are excluded (merged); pairs in the opt-out table are excluded.

## Two-way only — yes

Present **pairs**, not N-way groups. `mergeGames` deletes the sources, so after merging one pair of a 3-way group the next fetch offers the remaining pair — groups collapse iteratively. One 3-way group in the live data doesn't justify group UI, and pairwise keeps opt-out semantics simple (an opt-out is inherently a pair).

## Opt-out storage

```ts
export const gameDistinctPair = sqliteTable(
  "GameDistinctPair",
  {
    id: autoIncrementId(),
    gameAId: integer().notNull().references(() => game.id, ...),
    gameBId: integer().notNull().references(() => game.id, ...), // store with gameAId < gameBId
    createdAt: datetime().notNull().$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("GameDistinctPair_pair_key").on(t.gameAId, t.gameBId)],
);
```

`mergeGames` gains a step (like `GameStateChange`): re-point `gameAId`/`gameBId` from sources to target, then delete self-pairs and duplicate pairs. `splitGame` does nothing — a re-split game may be re-suggested, which is correct.

## API

- `GET /api/games/duplicates` → `{ pairs: [{ a, b }], distinct: [{ id, a, b, createdAt }] }` where `a`/`b` carry id, name, state, playtime, lastPlayedAt, release year, provider rows (for badges/art). Computed on demand: load all games + provider rows, bucket by normalised key, drop merged/opted-out pairs, sort by name. `distinct` is the current opt-out list for the undo section.
- `POST /api/games/distinct` `{ gameAId, gameBId }` → insert opt-out (normalise ordering server-side).
- `DELETE /api/games/distinct/[id]` → undo an opt-out.
- Confirm = existing `POST /api/games/merge` with `targetId`/`sourceIds: [otherId]`.

## UI

New page `/duplicates` (sidebar link; shows a count badge when pairs exist). One card per pair:

- Both games side by side: art, full name, provider badges, **release year**, playtime, state. Year is the user's defence against same-name-different-game.
- Actions: **"Keep this name"** on each side (merges the other into it — direction picks the surviving `Game`/name, matching doc 08's semantics) and **"Not the same"** (opt-out, card disappears).
- Below the suggestions: a collapsed **"Marked as distinct"** section listing opted-out pairs (both names, date) with an **Undo** button per row (`DELETE /api/games/distinct/[id]`; the pair reappears above if the names still match).
- No auto-merge, ever.

## Tests

- `normaliseGameName` unit tests seeded from the live examples above (trademark glyphs, trailing space, `GAME OF THE YEAR EDITION`, trailing `Enhanced`, `(2016)` retained, `Portal 2` ≠ `Portal`).
- Duplicates endpoint: finds a matching pair; excludes same-`Game` rows; excludes opted-out pair; opt-out ordering normalised; `distinct` list returned.
- Opt-out delete: pair reappears in suggestions.
- `mergeGames`: opt-out rows re-pointed, self/duplicate pairs removed.

## Steps

1. `normaliseGameName` + tests.
2. Schema: `GameDistinctPair` + migration; `mergeGames` re-pointing + tests.
3. `GET /api/games/duplicates`, `POST /api/games/distinct`, `DELETE /api/games/distinct/[id]` + tests.
4. `/duplicates` page with distinct-pairs undo section.

## Out of scope

- Auto-merge.
- Fuzzy/trigram matching — tested against the live db and rejected (see Matching).
- GOG gamesdb / external-id matching (22 GOG rows; revisit if name matching underperforms).
- Group (3+ way) presentation.
