---
type: task
status: open
---

# Playtime corrections

Written 2026-09-08 against `4f42a0d`. Builds on the timeline layer in [22](22-Playtime-Timeline.md) and the backfill / playthrough goals in [17](17-Product-Goals.md).

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
- A correction normally **re-places observed minutes**. The one additive form, `unreported`, exists because launchers lose sessions; it is an explicit user declaration that the store total is wrong, badged as such everywhere. Manual entry for games with no store row (consoles, unsupported stores) is still a separate feature and a separate provider.
- Precision is stored honestly. A rough date is stored rough, never as a fabricated datetime.
- The user is the authority. Grate validates against the evidence it holds (a claim cannot exceed its delta, cannot end after the store observed it) and otherwise obeys.
- Everything downstream reads the corrected timeline: game page, activity chart, `lastPlayedAt`, aggregates, future state automation. A late delta must not reset a stall clock if the user has already dated it.

## Model

```
PlaytimeCorrection
  id
  provider              steam | gog | epic
  providerId            appId / gogId / epicId
  claim                 claimed | staged | unreported
  claimFromSnapshotId   nullable  } contiguous range of rows in that provider's
  claimToSnapshotId     nullable  } playtime table; set iff claim = claimed
  minutes
  playedFrom            text, fuzzy date (grammar below)
  playedTo              text, same grammar; equals playedFrom for a single fuzzy date
  source                manual | save-file | achievements   (later: automated)
  note                  nullable
  createdAt
```

**Claims.** A correction claims a contiguous range of snapshot rows on one provider row. A single delta is the degenerate range; a Steam sitting merged from hourly flushes is a wider one. The claimed `minutes` must be at most the summed delta of the range; several corrections may claim the same range as long as the sum fits. Any unclaimed remainder stays as a residual session with the original window. The grounding baseline (`timestampStart: null` row plus partner) is claimable like any delta: that is how pre-history gets dated.

**Staged corrections** have no claim. They count in stats immediately and render flagged. Each sync, new deltas on the provider row are matched against staged corrections; a match binds the claim and drops the flag. A bound delta is excluded from ordinary derivation, so nothing double counts. Unmatched corrections can be bound by hand ("this is that") or marked permanent (store will never report it).

**Unreported corrections** have no claim and never seek one. They add minutes the store does not have. Grate's total for the game becomes store total plus unreported minutes; the raw sync modal still shows the store's own figure, so the divergence is inspectable. If a later delta on the same row looks like the unreported session (similar minutes, window after the declared end), flag it as a possible duplicate and offer to convert the correction to a claim. Suggest, never auto-bind, because the user has already said the store missed it.

**Matching tolerance:** decide from test scenarios. Starting guess: declared and observed minutes differ by under 15 min or 10%, whichever larger; also try one correction against the sum of consecutive deltas, since a Steam offline upload may arrive split. Users think in hours plus minutes, not exact minutes.

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
- Parser and formatter live in `shared/` next to `playDay.ts`; the same type will serve playthrough backfill and journal entries.

Rendering follows precision: `2020`, `Oct 2020`, `12–30 Oct 2020`, `Tue 12 Oct, 20:00–23:52`. Trailing `~` renders as the tilde the timeline already uses for fuzziness.

Defer `?`, `XX`, seasons and the `edtf` npm package until a real need appears.

## Derivation

1. `observeDeltas` as now.
2. `applyCorrections(deltas, corrections)`: for each claimed range, emit one session per correction (bounds from the resolved fuzzy dates, `anchored` iff both ends are exact datetimes, `uncertaintyMinutes` = window width otherwise) plus a residual session for any unclaimed minutes carrying the original delta window. Emit staged corrections as sessions with a `staged` flag.
3. Steam contiguity merging runs only over uncorrected deltas.
4. Bucketing: exact sessions use the end-bound play-day rule as today. Sessions whose window spans more than one play day count at the coarsest calendar unit (month, then year) that contains the window, and never on a day. The day chart notes "plus Nh imprecisely dated this month".

Validation on write: claimed minutes at most the range's delta; resolved `playedTo` at or before the last claimed row's `timestampEnd`; for a Steam baseline, at or before `rTimeLastPlayed`. Staged and unreported corrections only require `playedTo` not in the future.

## Case 1: present, precise

Cyberpunk-style: a 232-minute GOG delta lands Thursday in a 4-minute window; the user knows from the save file it ended Tuesday 23:52.

- Game page session row → "Correct…". Form prefills the delta's minutes; accepts start or end plus duration (save files give the end). Writes an exact correction claiming that delta.
- Session now renders anchored, `Tue 12 Oct, 20:00–23:52`, badged as corrected, original window in the tooltip.
- Splitting: an outage delta or offline upload covering several sittings gets several corrections; the residual stays fuzzy until fully claimed.
- Delta not arrived yet: "Add session" on the game page writes a staged correction. It shows flagged, counts now, and binds on the next matching sync.

## Case 2: history, rough

Quantum Break (game 328): Steam baseline 1053 min, `rTimeLastPlayed` 30 Oct 2020, nothing since. The user recalls a playthrough over a couple of weeks that October.

- Game page shows the undated pre-history block. "Date this…" opens the same form with the fuzzy-date input; the user enters `2020-10-12` to `2020-10-30`, or just `2020-10`, and all or part of the minutes.
- Writes a range correction claiming the baseline pair. Renders as a wide band labelled `12–30 Oct 2020`; counts in October 2020 and 2020 totals, on no particular day. "Your 2020 in games" becomes possible for pre-grate years.
- Achievements as evidence: unlock timestamps bound the *when*; the baseline supplies the *how much*. Manual for now (`source: achievements`, user reads unlock dates). Once achievements sync, grate can cluster unlock times per game and **propose** a range correction against undated pre-history for the user to confirm. Suggest, never auto-apply, per the automation posture in [17](17-Product-Goals.md).
- This is the playthrough backfill from [17](17-Product-Goals.md). The correction is the stored fact; playthrough promotion later wraps one or more corrections rather than carrying its own duration.

## Case 3: present, unreported

Cyberpunk again: played last night via Heroic on GOG; Heroic's exit bug meant the session was never posted, so GOG's `time_sum` did not move and no delta will ever arrive.

- "Add session" on the game page, same form as the staged path, with a choice: **awaiting the store** (staged, default) or **the store missed this** (unreported). Unsure users pick staged; if nothing arrives they can flip it to unreported later.
- Unreported writes an exact correction with `claim: unreported`. Renders anchored, badged unreported, counts in stats and moves `lastPlayedAt` to last night.
- `Game.playtimeMinutes` via `refreshGameAggregates` includes unreported minutes; the provider row keeps the store's figure.
- If the launcher turns out to post late rather than never, the duplicate check above catches the delta and offers to bind it, turning the unreported entry into an ordinary claim.
- Achievements are a natural cross-check here too: an unlock timestamp during the declared window corroborates the session.

## Touch points

- `server/services/playtimeTimeline.ts`: `applyCorrections`, claimed-range exclusion before merging.
- `server/services/activity.ts`: `getDailyPlaytime` reimplements the delta loop and would silently ignore corrections. Unify it onto the timeline service first, otherwise the game page and the activity chart disagree.
- `server/services/games.ts`: `getGameTimeline`; `refreshGameAggregates` and provider `lastPlayedAt` inference read the corrected timeline, so a dated offline delta can move `lastPlayedAt` backwards.
- Sync (`server/providers/*/service.ts`): after recording a delta, attempt to bind staged corrections; flag deltas resembling an unreported one.
- `refreshGameAggregates`: total = store total + unreported minutes.
- `shared/fuzzyDate.ts`: parse, resolve, format, compare.
- `app/`: correction form, badges (corrected, staged), pre-history "Date this…" affordance, activity-chart imprecise note.
- Migration adding `PlaytimeCorrection`.

## Decisions

1. Corrections re-place minutes, except `unreported`, the single additive form for store-linked rows whose launcher lost a session. Manual entry for games with no store row stays out of scope.
2. Staged corrections count immediately, flagged.
3. Exact sessions spanning the 06:00 boundary keep the end-bound rule.
4. Claims are contiguous snapshot ranges, so Steam merged runs are one claim.
5. Fuzzy dates stored as reduced-precision text, resolved at read time.
6. Matching tolerance set empirically from test scenarios.
7. Staged never binds by itself to unreported; the user flips it. Deltas resembling an unreported entry are flagged, never auto-bound.

## Unanswered questions

- Allow `~` in v1, or strictly reduced-precision only?
- Staged correction never matched after N syncs: nag with "mark as unreported?", or silently keep?
- Rough (range) precision for unreported play, e.g. "some evenings in August the launcher dropped"? Grammar allows it; is it worth exposing in the form?
- Range bucketing at the coarsest containing unit: confirmed, or end-bound even here?
