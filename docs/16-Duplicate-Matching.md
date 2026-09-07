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

All in TypeScript over in-memory names (878 provider rows, O(n²) trivial). No SQLite trigram extension, no persistence of suggestions — recomputed per request; only opt-outs persist.

Two tiers, both exact string work on names — no similarity scores. Measurements behind them in [Amendment (2026-09-07)](#amendment-2026-09-07).

### Tier 1 — identical normalised key

`normaliseGameName(name)` in `shared/`:

1. On the **raw** name, repeatedly strip a trailing `(…)`, ` - …` or `: …` segment when it has ≤6 words, contains ≥1 packaging word and every other word is glue. Digits never count as packaging, so `(2016)` year disambiguators survive. Handles `(Classic)`, `(Test branch)`, `- The Final Cut`, `: Ultra Deluxe`, `: 20 Year Celebration`, `- Soundtrack and Digital Goods Bundle`.
2. Lowercase, trim; strip `™ ® ©`; punctuation → space; collapse whitespace.
3. Strip edition phrases **anywhere**: `game of the year edition`, `goty( edition)?`, `definitive`/`complete`/`enhanced`/`ultimate`/`deluxe`/`gold`/`legacy`/`legendary`/`premium`/`anniversary`/`collector's`/`extended`/`standard` `edition`, `remastered`, `redux`, `director's cut`, `the final cut`, `re elected`; trailing bare `enhanced`.
4. Strip test-build phrases from the **end only**: `demo`, `playtest`, `beta demo`, `tech beta`, `public test server`/`client`, `public testing`, `staging branch`, `open`/`closed beta`, `network test`, `friend's pass`.

Packaging vocabulary deliberately excludes `vr`, `plus`, `infinite`, `original`, `source` — those mark distinct products.

Accepted consequences: compilation editions key to the base title (`Mass Effect Legendary Edition` → `mass effect`, `Civilization III: Complete` → `civ iii`, `Kingdom: Classic` → `kingdom`); `Lone Survivor: The Director's Cut` now keys to `lone survivor` (was `lone survivor the`).

### Tier 2 — packaging suffix

`isPackagingVariant(a, b)` in `shared/`, driven by a pairing pass in `duplicates.ts` over distinct tier-1 keys. Longer key must be shorter key + suffix.

- **Accept** when the suffix (digits dropped) has ≤5 words and either contains ≥1 packaging word or ends in `edition`.
- **Reject** when the first suffix word is a numeral, roman numeral or single letter — the sequel guard, ~40 pairs rejected.
- **Descriptive subtitle**, accepted separately: the longer name's pre-separator head keys equal to the shorter key and the subtitle is ≥4 non-numeric words (`Fallout` ↔ `Fallout: A Post Nuclear Role Playing Game`). `MIN_SUBTITLE_WORDS` 4 chosen: 5 drops the Dishonored false positive; 3 adds CoH `Tales of Valor`, `Life is Strange: Before the Storm`, `SUPERHOT: MIND CONTROL DELETE`.

> **Superseded (2026-09-07)** — the paragraph below stands only for *similarity-score* tier 2. Trigram/Dice matching is still rejected; tier 2 as shipped is exact suffix comparison with a sequel guard, and it does now catch `Saints Row IV`/`Re-Elected` and friends, so "single tier" and "stay manual merges" no longer hold.
>
> Trigram tier 2 was tested against dev.db and rejected: Dice similarity ≥ 0.8 on normalised keys, even with a trailing-numeral sequel guard, yields 37 extra pairs of which only ~3 are real — the guard can't catch `Train Sim World® 2`/`3`, `Battlefield™ 1`/`V`, `Telltale Batman Season 1`/`2`, or mid-string numerals (`Fallout: A Post Nuclear…`/`Fallout 2: A Post Nuclear…`), and VR/demo/season variants (`SUPERHOT VR`, `The Stanley Parable Demo`, `The Walking Dead: Season One`) are distinct products at high similarity. The few genuine leftovers (`Saints Row IV`/`Saints Row IV Re-Elected`, `Death Stranding`/`Death Stranding Content`) stay manual merges via the game page's existing "Merge into…".

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

Added with the amendment:

- Segment stripping: `(Classic)`, `(Test branch)`, `- Legacy Edition`, `- The Final Cut`, `: Ultra Deluxe`, `: 20 Year Celebration`, `- Soundtrack and Digital Goods Bundle`, `Throw-A-Santa + Sneak Peek 2.0`; `(2016)` still survives; no strip when the segment is the whole name.
- Widened edition phrases and end-only test-build phrases (`Demo`, `Playtest`, `Beta Demo`, `Tech Beta`, `Public Test Server`, `Public Testing`, `Staging Branch`, `Friend's Pass`).
- Non-packaging words stay: `SUPERHOT VR`, `Hexcells Plus`, `BioShock Infinite`, `Half-Life: Source` keep their suffixes.
- `isPackagingVariant`: accepts the 13 wanted pairs (`Company of Heroes`/`Legacy Edition`, `Mafia II`/`(Classic)`, `Saints Row IV`/`Re-Elected`, `Rise of the Tomb Raider`/`20 Year Celebration`, `Rust`/`Staging Branch`, `Portal`/`Portal with RTX`, …); rejects the 18 hard negatives (sequels, `Tomb Raider`/`Rise`/`Shadow`, Telltale Batman S1/S2, `Battlefield 1`/`V`, `Train Sim World 2`/`3`).
- Descriptive-subtitle rule: `Fallout` ↔ `Fallout: A Post Nuclear Role Playing Game` accepted; 3-word subtitles rejected.
- Duplicates service: tier 2 pairs appear alongside tier 1 pairs, and respect merged/opt-out exclusion.

## Steps

1. `normaliseGameName` + tests.
2. Schema: `GameDistinctPair` + migration; `mergeGames` re-pointing + tests.
3. `GET /api/games/duplicates`, `POST /api/games/distinct`, `DELETE /api/games/distinct/[id]` + tests.
4. `/duplicates` page with distinct-pairs undo section.

## Out of scope

- Auto-merge.
- Similarity scoring (trigram/Dice) — tested against the live db and rejected (see Matching). Tier 2 is exact suffix comparison, not fuzzy.
- GOG gamesdb / external-id matching (22 GOG rows; revisit if name matching underperforms).
- Group (3+ way) presentation.
- Provider-metadata signals (Steam app type, Epic namespace) — checked and rejected for now; see the amendment.

## Amendment (2026-09-07)

Measured against dev.db, 878 provider rows.

### Problem

Exact-key matching found **0** pairs: the user had already hand-merged everything it catches, including edition and test-build variants the key missed — `The Outer Worlds` / `…: Spacer's Choice Edition`; `Control` / `Control Ultimate Edition`; `Disco Elysium` / `- The Final Cut`; `The Stanley Parable` / `Demo` / `: Ultra Deluxe`; `DEFCON` / `Beta Demo`; `Fallout 76` / `Public Test Server`; `The Last Starship` / `Playtest`; `Eriksholm` / `Demo`; `Dark Pictures Little Hope` / `Friend's Pass`.

Still unmerged and wanted: `Company of Heroes` / `- Legacy Edition`; `Mafia II: Definitive Edition` / `Mafia II (Classic)`; `Saints Row IV` / `Re-Elected`; `Styx: Shards of Darkness` / `- Deluxe Edition`; `Rise of the Tomb Raider` / `: 20 Year Celebration`; `PlanetSide 2` / `- Test`; `Rust` / `- Staging Branch`; `Mortal Shell` / `Tech Beta`; `Chivalry 2` / `- Public Testing`; `Galactic Civilizations III` / `(Test branch)`; `Portal` / `Portal with RTX`; `We Happy Few` / `- Soundtrack and Digital Goods Bundle`; `Wreckfest` / `Throw-A-Santa + Sneak Peek 2.0`.

### Results

- 23/23 known positives matched; 0 currently-found pairs lost; 0 of 18 hard negatives paired.
- Game-level finder yields **18** suggestions: the 13 wanted plus 5 deliberate extras — `Fallout` ↔ `Fallout: A Post Nuclear Role Playing Game` and `Fallout 2` ↔ its long name (both correct: Steam short name vs Epic long name), `The Walking Dead` ↔ `Season One` (Telltale renamed it — arguably correct), `The Walking Dead` ↔ `Season Two` (wrong, the cost of `season` as a packaging word), `Dishonored` ↔ `Death of the Outsider` (wrong, the cost of the 4-word subtitle rule).

Design stance: **lean permissive**. The user dismisses wrong suggestions with "Not the same" (and the opt-out persists), so a handful of explainable false positives is the target, not zero.

### Rejected alternatives

- **Denylist-only tier 2** (accept any short suffix except a denylist): 55 false positives, 11 hard-negative violations — `Assassin's Creed` base ↔ every subtitle entry, all Half-Life spin-offs, HITMAN, every VR variant, Walking Dead seasons, Fallout `New Vegas`/`London`/`Tactics`.
- **Greedy `(\S+ ){0,2}edition$`** stripping: over-strips — `company of heroes legacy edition` → `company of`.
- **Generic edition-tail stripping inside the key**: asymmetric, and lost `Bad North: Jotunn Edition` ↔ `Bad North Jotunn Edition`.
- **`vr` as a packaging word**: adds all five VR variants at once.
- **Bare 1-word suffix acceptance**: adds ~25 spin-offs (Hexcells `Plus`/`Infinite`, BioShock `Infinite`, DOOM `Eternal`, Assassin's Creed `Odyssey`/`Origins`/`Unity`, Elite Dangerous `Arena`, Mirror's Edge `Catalyst`, Half-Life `Alyx`/`Source`…).

### Provider signals checked and rejected for now

- `SteamAppInfo.type` is almost all `game` — the soundtrack bundle is typed `game`, most test-build rows have no app-info row at all, and there is no parent/`fullgame` column until [18-Steam-PICS-Metadata](18-Steam-PICS-Metadata.md)/[27-DLC](27-DLC.md) PICS work lands.
- `EpicGame.namespace` groups 5 pairs, 4 genuine + Telltale Batman S1/S2 (a hard negative) — adds nothing over names.

Revisit when PICS parents land.

### Open follow-ups

- Test builds and demos are merged like editions, so demo playtime folds into the game's total, timeline and `lastPlayedAt` (Eriksholm demo 99 min, Stanley Parable demo 36) and could trip the playtime-driven state automation in [17-Product-Goals](17-Product-Goals.md). Options: a non-retail flag on the provider row, or a parent relation like the [27-DLC](27-DLC.md) design.
- Bundle/soundtrack rows should eventually be hidden by triage (doc 27); matching them here is intentional in the meantime.
