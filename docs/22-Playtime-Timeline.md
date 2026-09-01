---
type: task
status: done
---

# Playtime timeline layer

Derive a session timeline from raw playtime snapshots instead of showing snapshots directly. Raw history stays untouched.

## Baseline: the problem, seen in Cyberpunk 2077 (game 620, GOG 1423049311)

`GogGamePlaytime` rows:

| id | timestampStart | timestampEnd | playtimeMinutes |
|----|----------------|--------------|-----------------|
| 7 | null | 2026-08-30 14:14:45 | 11336 |
| 29 | 2026-08-30 14:14:45 | 2026-08-31 20:39:20 | 11336 |
| 45 | 2026-08-31 20:39:20 | 2026-08-31 20:43:46 | 11406 |
| 46 | 2026-08-31 20:43:46 | 2026-09-01 01:00:06 | 11406 |

Record 45: +70 minutes observed in a 4.5-minute window. GOG's `time_sum` only updates when a session ends, so the session ended within that window but the play itself started ~19:33 or earlier — before the window began. Rendered naively this reads as "70 minutes of play in 4 minutes". Same shape occurs hourly-sync-wide: hours of play appearing inside one hour.

Semantics of the raw rows (`recordGogPlaytime`, `lib/gog/service.ts:327`): a change record means "cumulative total became X at some unknown point in (start, end]"; a no-change record's `timestampEnd` is extended each sync; the first import writes a baseline pair (records 7/29 here — 11336 min of pre-history, not a session). Steam (`lib/steam/service.ts`) and Epic write the same shape; Steam rows also carry `rTimeLastPlayed`.

## Constraints

- Sampling is hourly (or on manual sync); within a window we cannot know when play happened or whether it was contiguous.
- A delta may cover several sessions, and may exceed the window length (GOG/Epic report only on session end; a long session lands entirely in one window).
- GOG gives no last-played (`docs/09`): `lastPlayedAt` must be inferred from playtime deltas.
- Steam updates playtime during play and supplies `rtime_last_played`, so Steam deltas anchor better — the layer should use provider anchors when available.
- Do not rewrite raw timestamps; this is a read layer on top.

## Design sketch

Pure function: ordered raw records for a provider row → inferred sessions.

For each consecutive pair with `delta = curr.playtime − prev.playtime > 0`, emit a session:

- `minutes`: delta.
- `endedBetween`: (`curr.timestampStart`, `curr.timestampEnd`] — for GOG/Epic the session end must lie in this window.
- `estimatedStart`: `curr.timestampEnd − delta` (may precede the window — that's the point).
- `uncertaintyMinutes`: window width plus any delta overshoot; ~0 for Steam anchored on `rTimeLastPlayed`, small for a tight manual-sync window, large for missed syncs (see downtime section).
- Skip the initial grounding pair (`timestampStart: null` baseline + its partner) — pre-history, not a session.
- Steam: when `rTimeLastPlayed` changed, use it to anchor the session *end* — it is the moment Steam last flushed the total, so it dates the end of the play the delta counts, not its start. `estimatedStart = anchor − delta`.
- Steam flushes hourly mid-session, so one sitting arrives as a run of anchored deltas whose ends meet the next start. Merge consecutive anchored deltas of the same provider row when the gap is within 5 minutes (observed jitter ≤ 1s); never merge unanchored ones — GOG/Epic already report per completed session, and an unanchored Steam delta gives no contiguity evidence.

Inferred `lastPlayedAt` for GOG (and Epic where absent) = end bound of the latest inferred session, written to `GogGame.lastPlayedAt` and flowed through `refreshGameAggregates` — canonical store, so all-games filtering/sorting keeps working with no special cases.

Compute on read first (`lib/playtimeTimeline.ts` or similar, unit-tested against fixtures like the Cyberpunk rows above); materialise later only if it's slow. Expose via `getGamePlaytimes` or a new `/api/games/[id]/timeline`.

## Decisions

1. **Game page shows the timeline, not raw rows.** Raw-history table moves to a debug view opened from a modal — retained for diagnosing sync behaviour only.
2. **Inferred GOG `lastPlayedAt` is written to the DB** (`GogGame.lastPlayedAt` → aggregates), not display-only.
3. **Downtime handled by degrading precision, not by splitting.** See below.
4. **Cross-provider: merged timeline in the UI**, each session badged with its provider. The derivation stays per-provider row; merge at render/API level, sorted by end bound.
5. **UI: expect trial and error.** Options catalogued below; build the cheapest first.

## Downtime / gap scenarios

All collapse to "window got wide"; the maths doesn't change, precision does.

- **Server down over N hourly syncs**: no rows written while down; next sync writes one change record spanning last `timestampEnd` → now. One inferred session carrying the whole delta, window = the outage. Could be many real sessions.
- **Provider API failing** (GOG errors, token expiry): same shape — rows stop, window widens.
- **Long single session** (longer than sync interval): for GOG/Epic nothing is reported until it ends, so this is indistinguishable from a gap; already covered by `estimatedStart` preceding the window.
- **Offline play** (Steam `playtimeDisconnected`): delta may surface long after the play happened; window bound is honest ("some time before X") even though wide. When `playtimeDisconnected` grows across a pair the delta is treated as offline play: it is dated by the changed `rTimeLastPlayed` (else the window end) but left unanchored, with uncertainty the wider of the delta and the window, since one upload may cover several sittings — unverified against real rows, as none with a disconnected increase exist in the dev database yet.

Handling: replace the enum-ish `precision` with a measured `uncertaintyMinutes` (window width, or window width + delta overshoot). UI maps it to fuzziness continuously — a 4-minute manual-sync window renders near-exact, a 3-day outage renders as a wide fuzzy block. No split heuristic: never invent sessions the data can't support.

## UI options to trial

Cheapest first; a+d likely the starting point, b/c candidates once data accumulates.

- **a. Session list** (replaces current table): per row "~70 min · ended between 20:39–20:44 · GOG", tilde and range width conveying fuzziness; very wide windows say "sometime between 30 Aug and 2 Sep".
- **b. Horizontal day timeline**: one lane per day, sessions as bars placed at estimated position; uncertainty as soft/gradient bar edges or a lighter full-window band behind the solid estimated-duration bar.
- **c. Day-bucketed activity chart** (per-day totals bar chart or heatmap strip): sidesteps intra-day uncertainty entirely; sessions spanning a day boundary allocated to the day of the end bound. Good for the long view, no per-session detail.
- **d. Confidence affordance**: dotted borders / muted colour / "≈" badge on low-confidence sessions, tooltip explaining the observation window. Composable with a–c.

6. **Debug modal is a sync-debug surface**, not just a raw-rows table: primarily for understanding how sync is behaving (owner use), secondarily lets users inspect raw data to debug their own installs or explain grate's behaviour. Per-game raw rows are the entry point from the game page.
7. **Day boundary is 06:00 local, not midnight** — gaming is an evening activity, so a 1am session belongs to the previous "day". Configurable per user. Applies to day bucketing (UI option c) and any "played on N days" style stats; boundary-spanning sessions allocate to the day of their end bound.

## Server timezone

"06:00 local" needs the server to know what local is. Follow self-hosted docker conventions:

- `TZ` environment variable is the supported convention — Node respects it natively for `Date` local methods and `Intl`; document it in compose/README with a sensible example (`TZ=Europe/London`). Image is `node:*-slim` (Debian), so tzdata is present; no Dockerfile change needed.
- `/etc/localtime` mounts happen to work (glibc reads it when `TZ` unset) but are not the documented path — prefer `TZ`.
- Default when unset: UTC (container default). Fine, just means the 06:00 boundary is UTC-relative until configured.
- Precedence: per-user setting > server `TZ`. Day bucketing computes in that zone; timestamps stay stored as UTC epoch ms.
- User settings (timezone override, day-boundary hour) live on the existing `User` table (`db/schema.ts:24`) when built — editable in the web UI, not more env vars.

## Landed

- **Derivation**: `deriveSessions`/`inferredLastPlayedAt` (`lib/playtimeTimeline.ts`). Grounding pair needs no special case — its delta is 0, so it's skipped like any zero delta. Steam anchors a session's *end* on `rTimeLastPlayed` (the last flush time) whenever it changed, with `estimatedStart = end − minutes`; continuation deltas (unchanged anchor) fall back to window bounds. Consecutive anchored deltas whose gap is within `CONTIGUOUS_ANCHOR_TOLERANCE_MINUTES` (5) are merged into one session, so a long Steam sitting reads as one row rather than a dozen "1h" ones. `uncertaintyMinutes = max(windowMinutes, minutes)` when unanchored, 0 when anchored.
- **API**: `getGameTimeline` (`lib/games.ts`) + `GET /api/games/[id]/timeline`, sharing the per-provider snapshot loader with `getGamePlaytimes`.
- **GOG/Epic `lastPlayedAt`**: inferred via `inferredLastPlayedAt` in `lib/gog/service.ts` and `lib/epic/service.ts` when the provider gives none. Backfills on next sync; no data migration.
- **UI**: game page renders `PlaytimeSessionList` (options a + d) grouped by day, replacing the raw table. Wording rules in `app/utils/formatSessionWindow.ts` (an anchored session renders as a range, `11 Jul 18:53 – 20:11`); a session is low-confidence when `uncertaintyMinutes > 2 × minutes` or the observation window exceeds 24h. Raw cumulative rows moved behind `PlaytimeRawHistoryModal` ("Raw sync data").
- **Play day**: `User.timezone`/`dayBoundaryHour` (migration `0008_user_settings.sql`, default boundary 06:00) + `shared/playDay.ts` (`playDayOf`) + `/api/settings` (GET/PATCH) + a Settings page. `getDailyPlaytime` (`lib/activity.ts`) and the game-page day grouping both bucket by play day, not calendar day.

Open follow-ups: UI options b (horizontal day timeline) and c (day-bucketed activity chart) not built. Materialising the timeline (vs computing on read) not needed yet — revisit if slow. Debug modal is still just raw rows, not the fuller sync-debug surface sketched in decision 6's second half.

## Unanswered questions

None.
