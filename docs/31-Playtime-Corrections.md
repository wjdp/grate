---
type: task
status: open
---

# Playtime corrections

Written 2026-09-08 against `4f42a0d`. Builds on the timeline layer in [22](22-Playtime-Timeline.md) and the backfill / playthrough goals in [17](17-Product-Goals.md).

## Revision

Revised 2026-09-12. A first attempt (branch `playtime-correction-gpt`) built contiguous snapshot-range claims, three claim kinds, auto-reconciliation and a materialised projection. Reviewed as far more than the three cases need; this revision keeps the problem statement and fuzzy dates and replaces the model.

## Problem

Stores expose cumulative totals, so a delta is a correct **amount** with an uncertain **placement**. Two ways that goes wrong:

- **Late arrival.** GOG/Epic report only on session end; Steam offline play uploads when the client next connects; the server may be down. The minutes appear days later, in a wide window, and get bucketed on the day the window closed.
- **Wrong day.** The delta arrived but `playDayOf(session.endedBefore)` puts it on the observation day, not the play day.

The user often knows better: save-file timestamps, memory, achievement unlock dates. There is no way to say so. Worse, a bucket of pre-grate history (the grounding baseline, e.g. Quantum Break's 1053 min all before 30 Oct 2020) can never be placed at all.

A third failure is different in kind: the store total never moved at all. Observed with Heroic Games Launcher on GOG, where an exit-behaviour bug drops the session so GOG never learns of it. The minutes are not late; they are missing.

Three cases, one mechanism:

| | Present: precise correction | History: rough correction | Present: unreported play |
| --- | --- | --- | --- |
| Evidence | Save files, memory of the evening | Rough memory, achievement dates | Memory, save files |
| Placement | Exact start/end datetimes | A date range, month or year | Exact start/end datetimes |
| Claims from | A recent delta, or nothing yet (staged) | The baseline delta (pre-history) | Nothing, ever (unreported) |
| Renders as | Anchored session, uncertainty 0 | Unanchored session, window = range | Anchored session, badged unreported |
| Buckets to | Play day (end-bound rule) | Coarsest calendar unit containing the window; never a day | Play day |

## Principles

- Raw snapshot rows stay immutable evidence ([22](22-Playtime-Timeline.md)). Corrections are a read layer over derivation.
- A correction normally **re-places observed minutes**. The one additive form is a manual session with no snapshot: an explicit user declaration that the store missed play. Manual entry for games with no store row (consoles, unsupported stores) is still a separate feature and a separate provider.
- Precision is stored honestly. A rough date is stored rough, never as a fabricated datetime.
- The user is the authority. Grate validates against the evidence it holds (a claim cannot exceed its delta, cannot end after the store observed it) and otherwise obeys.
- Everything downstream reads the corrected timeline: game page, activity chart, `lastPlayedAt`, aggregates, future state automation. A late delta must not reset a stall clock if the user has already dated it.

## Model

```
PlaytimeCorrection
  id
  provider       steam | gog | epic
  providerId     appId / gogId / epicId
  snapshotId     nullable. Id of the row in that provider's playtime table whose delta
                 this re-places. For the baseline it is the first row (timestampStart null).
                 null = manual additive session the store never reported.
  minutes        > 0
  playedFrom     fuzzy date text (grammar below)
  playedTo       fuzzy date text; equals playedFrom for a single fuzzy date
  note           nullable
  createdAt
```

- A correction targets one snapshot row: the row that introduced a positive cumulative delta, or the baseline row. Its capacity is that delta (baseline: the cumulative total on the first row). A lone correction re-places the whole delta: the session renders with the store's minutes, and the correction's own minutes only cap what it may claim. Several corrections may target the same row to split it into several played periods; their minutes sum to at most the capacity, and any remainder stays as a residual session in the original observation window. The baseline is the exception: its remainder is always reported as undated pre-history, bounded by the baseline row's `timestampEnd` (for Steam this is grounded on `rTimeLastPlayed`, the last time the game was played before grate), so a lone baseline correction does not absorb it.
- Snapshot rows are never deleted (verified: no code deletes from the playtime tables), so the reference is stable. It is polymorphic across three tables, so no FK; the service checks ownership.
- Manual sessions (`snapshotId` null) are additive. If the store later reports the play, the user binds the correction to that delta by patching `snapshotId`, or deletes it. No automatic matching.
- No Steam merged-run claims: corrections target single deltas. A merged Steam sitting is already anchored and rarely needs correcting; the UI does not offer Correct… on multi-delta sessions.

## Fuzzy dates

Relevant standard: **EDTF** (ISO 8601-2:2019, Extended Date/Time Format), Library of Congress. Level 0 is reduced-precision ISO plus intervals; Level 1 adds `~` approximate, `?` uncertain, `XX` unspecified.

v1 grammar, a Level 0 subset with `~`:

```
YYYY
YYYY-MM
YYYY-MM-DD
YYYY-MM-DDTHH:MM
any of the above with a trailing ~
```

- Precision is implicit in the string. Full datetime on both ends means exact.
- Resolve to `[earliest, latest]` instants at read time in the user's timezone via the play-day settings. Never store resolved bounds, or a timezone change silently shifts history.
- Mixed precision allowed: `2020-10-12T20:00` to `2020-10-13` ("started 8pm, finished sometime next day").
- Reject `playedTo` earlier than `playedFrom` after resolution.
- Sorts lexicographically as text.
- Implemented in `shared/fuzzyDate.ts`: parse, resolve to `[earliest, latest]` in a timezone, range resolution, compare, format. Salvaged from the first attempt.

Rendering follows precision: `2020`, `Oct 2020`, `12–30 Oct 2020`, `Tue 12 Oct, 20:00–23:52`. Trailing `~` renders as the tilde the timeline already uses for fuzziness.

Defer `?`, `XX` and seasons until a real need appears.

## Derivation

`deriveTimeline(snapshots, row, corrections, playDaySettings)` in `server/services/playtimeTimeline.ts`, replacing `deriveSessions`:

1. Observe deltas as now, each carrying the id of the row that introduced it.
2. A delta with exactly one correction emits one session, placed by the correction and carrying the delta's minutes: a lone correction re-places the whole delta; the store's minutes are grate's unit. A delta with several corrections emits one session per correction with that correction's minutes, plus a residual session with the original window if they sum to less than the delta. Residuals only arise when several corrections split a delta. Corrected deltas never take part in Steam contiguity merging.
3. The baseline (first row, `timestampStart` null, cumulative > 0) is treated the same: corrections against it become sessions; any remainder is reported as undated pre-history minutes, not as a session.
4. Manual corrections become additive sessions.
5. A session from a correction: exact when both ends are minute-precision → `anchored`, `uncertaintyMinutes` 0, bounds are the resolved instants. Otherwise unanchored, bounds `[earliest, latest]`, `uncertaintyMinutes` = width. `~` marks a time as approximate for display only and never affects placement: `2026-09-12T00:33~` is placed exactly as `2026-09-12T00:33` is.
6. Bucketing. Observed and exact sessions: end-bound play day as today. A correction whose ends are both day-precision and name the same date buckets to that calendar date — a user writing `2026-09-03` means that day, so the play day boundary is not applied. Coarser or mixed precision buckets to the coarsest calendar unit containing the range — month if within one month, else year, else unallocated — never a day. Every session carries `playDay`, `calendarMonth` and `calendarYear`, each null when not applicable; exact sessions fill all three from the play day.
7. `inferredLastPlayedAt` unchanged (GOG/Epic, raw deltas). `Game.lastPlayedAt` = max of the provider-derived value and the latest correction end. Dating a late delta backwards does not yet lower it; revisit with state automation.
8. `Game.playtimeMinutes` = store totals + manual correction minutes.

Validation on write: minutes a positive integer; `playedTo` not before `playedFrom` after resolution; snapshot belongs to the provider row and is the baseline or a positive-delta row; sum of minutes on that snapshot ≤ capacity; resolved `playedTo` latest bound ≤ that row's `timestampEnd`; manual corrections' `playedTo` ≤ now. Nothing else — overlapping played periods are the user's business.

## Consumers

- `getGameTimeline` returns `{ sessions, undated }`; `undated` lists per provider row the pre-history minutes not yet dated, with the baseline `snapshotId` and its `before` bound (the baseline's `timestampEnd`) so the UI can offer Date this…. Sessions carry `snapshotId` (single-delta observed/residual sessions only) and `correction` (`{ id, playedFrom, playedTo, note }` or null).
- `getDailyPlaytime` moves onto `deriveTimeline` so the activity chart and the game page agree. Its response gains imprecise totals for the year: per-month minutes and year-only minutes, never assigned to days. Cross-year ranges are omitted from yearly activity.
- `refreshGameAggregates` adds manual minutes and the latest correction end.
- API: `GET/POST /api/games/[id]/corrections`, `PATCH/DELETE /api/games/[id]/corrections/[correctionId]`. Mutations verify the correction's provider row belongs to the game and refresh aggregates.
- UI: game page — Correct… on a single-delta session (prefilled with its minutes as the cap), Date this… on undated pre-history, Add session (manual). One form: from, to, minutes, note. Corrected and manual badges; original observation window in the tooltip of a corrected session; edit and delete. Activity page: imprecise month/year totals shown as text beside the heatmap ("plus 8h imprecisely dated: Oct 6h, Nov 2h"), not fabricated onto days.

## The three cases, revisited

**Case 1: present, precise.** Cyberpunk-style GOG delta.

- Correct… on the single-delta session; form prefilled with the delta's minutes as the cap.
- Exact dates in, exact dates out: session renders anchored, badged corrected, original window in the tooltip.
- Splitting a delta into several sittings: several corrections against the same snapshot, minutes summing to at most the capacity.
- Delta hasn't arrived yet: not handled here — Add session (Case 3) covers it, bound to the delta later.

**Case 2: history, rough.** Quantum Break's baseline.

- Date this… on the undated pre-history block opens the same form; `2020-10-12` to `2020-10-30`, or just `2020-10`.
- Buckets to the coarsest containing unit — October 2020 here — never a day.
- Several playthrough periods within the pre-history: several corrections against the baseline snapshot.
- Any remainder stays undated pre-history, offered again next time.
- Achievements later **propose** a range against undated pre-history for the user to confirm; never auto-applied.

**Case 3: present, unreported.** Heroic-on-GOG dropped session.

- Add session, manual: `snapshotId` null, exact dates, minutes entered by hand.
- Counts in stats and `Game.playtimeMinutes` immediately; moves `lastPlayedAt`.
- If the store later reports the same play, the user binds the correction to that delta by patching `snapshotId` (or deletes it) — no automatic matching.

## Decisions

1. One target: a single snapshot row (delta or baseline). No contiguous ranges.
2. Two forms: re-place (snapshotId set) and manual additive (null). No staged kind, no auto-matching.
3. Capacity is a cap for the baseline too; no override or signed adjustment. Play beyond the store total is a manual session.
4. No played-period overlap validation.
5. Compute on read, as doc 22 decided. No projection table; ~3k snapshot rows is nothing.
6. Fuzzy dates stored as reduced-precision text, resolved at read time in the user's timezone. `~` allowed.
7. Imprecise corrections bucket to the coarsest containing calendar unit; exact and observed sessions keep the end-bound play-day rule.
8. Multi-delta (merged Steam) sessions are not correctable in v1.

## Follow-ups

- `lastPlayedAt` lowered by backdated corrections (needed once state automation lands).
- Achievement-proposed corrections.
- Correcting merged Steam runs.
- Save-file sitting detection should split on any playthrough-time stall of a few minutes; GOG logs once per exit, verified 12 Sep 2026.

## Unanswered questions

None.
