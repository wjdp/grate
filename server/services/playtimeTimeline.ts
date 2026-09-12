import { DateTime } from "luxon";
import { parseFuzzyDate, resolveFuzzyDateRange } from "#shared/fuzzyDate";
import { type PlayDaySettings, playDayOf } from "#shared/playDay";
import type {
  PlaytimeProvider,
  PlaytimeSession,
} from "#shared/types/PlaytimeSession";

const MILLISECONDS_PER_MINUTE = 60_000;

// Steam flushes a game's total every hour or so, so one sitting arrives as a
// run of anchored deltas whose ends and starts meet. Flush timing jitters by a
// second or two; this absorbs that without joining genuinely separate sittings.
const CONTIGUOUS_ANCHOR_TOLERANCE_MINUTES = 5;

export type DerivedSession = PlaytimeSession;

export interface PlaytimeSnapshot {
  id?: number;
  timestampStart: Date | null;
  timestampEnd: Date;
  playtimeMinutes: number;
  rTimeLastPlayed?: number | null;
  playtimeDisconnected?: number | null;
}

export interface PlaytimeProviderRow {
  provider: PlaytimeProvider;
  providerId: number;
  providerName: string;
}

export interface CorrectionInput {
  id: number;
  snapshotId: number | null;
  minutes: number;
  playedFrom: string;
  playedTo: string;
  note: string | null;
}

export interface DerivedTimeline {
  sessions: DerivedSession[];
  undatedMinutes: number;
  baselineSnapshotId: number | null;
}

interface ObservedDelta {
  snapshotId: number | null;
  minutes: number;
  endedAfter: Date;
  endedBefore: Date;
  lastPlayedAnchor: number | null;
  previousLastPlayedAnchor: number | null;
  playedOffline: boolean;
}

// Sessions built from a correction, and the residuals of a corrected delta,
// must not be folded into a neighbouring Steam run.
type UnbucketedSession = Omit<
  DerivedSession,
  "playDay" | "calendarMonth" | "calendarYear"
> & { mergeable: boolean };

function byObservationOrder(a: PlaytimeSnapshot, b: PlaytimeSnapshot) {
  const endDifference = a.timestampEnd.getTime() - b.timestampEnd.getTime();
  if (endDifference !== 0) {
    return endDifference;
  }
  if (!a.timestampStart && !b.timestampStart) {
    return 0;
  }
  if (!a.timestampStart) {
    return -1;
  }
  if (!b.timestampStart) {
    return 1;
  }
  return a.timestampStart.getTime() - b.timestampStart.getTime();
}

function orderedSnapshots(snapshots: PlaytimeSnapshot[]): PlaytimeSnapshot[] {
  return [...snapshots].sort(byObservationOrder);
}

function observeDeltas(snapshots: PlaytimeSnapshot[]): ObservedDelta[] {
  const ordered = orderedSnapshots(snapshots);
  const deltas: ObservedDelta[] = [];
  for (let index = 1; index < ordered.length; index++) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (!previous || !current) {
      continue;
    }
    const minutes = current.playtimeMinutes - previous.playtimeMinutes;
    if (minutes <= 0) {
      continue;
    }
    deltas.push({
      snapshotId: current.id ?? null,
      minutes,
      endedAfter: current.timestampStart ?? previous.timestampEnd,
      endedBefore: current.timestampEnd,
      lastPlayedAnchor: current.rTimeLastPlayed ?? null,
      previousLastPlayedAnchor: previous.rTimeLastPlayed ?? null,
      playedOffline:
        (current.playtimeDisconnected ?? 0) -
          (previous.playtimeDisconnected ?? 0) >
        0,
    });
  }
  return deltas;
}

function baselineSnapshot(snapshots: PlaytimeSnapshot[]) {
  const first = orderedSnapshots(snapshots)[0];
  if (!first || first.timestampStart !== null || first.playtimeMinutes <= 0) {
    return null;
  }
  return first;
}

// The minutes each correctable row can account for: the pre-history total on
// the baseline, the delta on every row that introduced one.
export function snapshotCapacities(
  snapshots: PlaytimeSnapshot[],
): Map<number, number> {
  const capacities = new Map<number, number>();
  const baseline = baselineSnapshot(snapshots);
  if (baseline?.id !== undefined) {
    capacities.set(baseline.id, baseline.playtimeMinutes);
  }
  for (const delta of observeDeltas(snapshots)) {
    if (delta.snapshotId !== null) {
      capacities.set(delta.snapshotId, delta.minutes);
    }
  }
  return capacities;
}

// `rTimeLastPlayed` is the moment Steam last flushed the total, so it dates the
// end of the play the delta counts, not its start.
function changedLastPlayed(
  delta: ObservedDelta,
  provider: PlaytimeProvider,
): Date | null {
  if (provider !== "steam" || delta.lastPlayedAnchor === null) {
    return null;
  }
  if (delta.lastPlayedAnchor === delta.previousLastPlayedAnchor) {
    return null;
  }
  return new Date(delta.lastPlayedAnchor * 1000);
}

function widerOfWindowAndSession(windowMinutes: number, minutes: number) {
  return Math.max(windowMinutes, minutes);
}

function toSession(
  delta: ObservedDelta,
  row: PlaytimeProviderRow,
  minutes: number,
  mergeable: boolean,
): UnbucketedSession {
  const bounds = {
    ...row,
    minutes,
    endedAfter: delta.endedAfter,
    endedBefore: delta.endedBefore,
    snapshotId: delta.snapshotId,
    correction: null,
    mergeable,
  };
  const lastPlayed = changedLastPlayed(delta, row.provider);
  if (lastPlayed && !delta.playedOffline) {
    return {
      ...bounds,
      estimatedStart: new Date(
        lastPlayed.getTime() - minutes * MILLISECONDS_PER_MINUTE,
      ),
      estimatedEnd: lastPlayed,
      uncertaintyMinutes: 0,
      anchored: true,
    };
  }
  const windowMinutes =
    (delta.endedBefore.getTime() - delta.endedAfter.getTime()) /
    MILLISECONDS_PER_MINUTE;
  // Play banked offline arrives as one upload that may cover several sittings,
  // so `rTimeLastPlayed` dates the last of them rather than bounding one
  // session: date the delta by it, but keep it fuzzy and unmergeable.
  if (delta.playedOffline) {
    const estimatedEnd = lastPlayed ?? delta.endedBefore;
    return {
      ...bounds,
      estimatedStart: new Date(
        estimatedEnd.getTime() - minutes * MILLISECONDS_PER_MINUTE,
      ),
      estimatedEnd,
      uncertaintyMinutes: widerOfWindowAndSession(windowMinutes, minutes),
      anchored: false,
    };
  }
  const estimatedStart =
    row.provider === "steam"
      ? delta.endedAfter
      : new Date(
          delta.endedBefore.getTime() - minutes * MILLISECONDS_PER_MINUTE,
        );
  return {
    ...bounds,
    estimatedStart,
    estimatedEnd: delta.endedBefore,
    uncertaintyMinutes: widerOfWindowAndSession(windowMinutes, minutes),
    anchored: false,
  };
}

function toCorrectedSession(
  correction: CorrectionInput,
  row: PlaytimeProviderRow,
  timezone: string,
): UnbucketedSession {
  const { earliest, latest } = resolveFuzzyDateRange(
    correction.playedFrom,
    correction.playedTo,
    timezone,
  );
  const from = parseFuzzyDate(correction.playedFrom);
  const to = parseFuzzyDate(correction.playedTo);
  const exact =
    from.precision === "minute" &&
    to.precision === "minute" &&
    !from.approximate &&
    !to.approximate;
  return {
    ...row,
    minutes: correction.minutes,
    endedAfter: earliest,
    endedBefore: latest,
    estimatedStart: earliest,
    estimatedEnd: latest,
    uncertaintyMinutes: exact
      ? 0
      : (latest.getTime() - earliest.getTime()) / MILLISECONDS_PER_MINUTE,
    anchored: exact,
    snapshotId: null,
    correction: {
      id: correction.id,
      playedFrom: correction.playedFrom,
      playedTo: correction.playedTo,
      note: correction.note,
    },
    mergeable: false,
  };
}

// An unanchored delta carries no evidence that it continues the previous one,
// and GOG/Epic already report one delta per completed session.
function continuesPrevious(
  previous: UnbucketedSession,
  next: UnbucketedSession,
) {
  if (!previous.mergeable || !next.mergeable) {
    return false;
  }
  if (!previous.anchored || !next.anchored) {
    return false;
  }
  const gapMinutes =
    Math.abs(next.estimatedStart.getTime() - previous.estimatedEnd.getTime()) /
    MILLISECONDS_PER_MINUTE;
  return gapMinutes <= CONTIGUOUS_ANCHOR_TOLERANCE_MINUTES;
}

function mergeContiguousSessions(sessions: UnbucketedSession[]) {
  return sessions.reduce<UnbucketedSession[]>((merged, session) => {
    const previous = merged.at(-1);
    if (!previous || !continuesPrevious(previous, session)) {
      merged.push(session);
      return merged;
    }
    merged[merged.length - 1] = {
      ...previous,
      minutes: previous.minutes + session.minutes,
      endedAfter: session.endedAfter,
      endedBefore: session.endedBefore,
      estimatedEnd: session.estimatedEnd,
      // A merged run spans several rows, so no single row can be corrected.
      snapshotId: null,
    };
    return merged;
  }, []);
}

function bucketOfPlayDay(playDay: string) {
  return {
    playDay,
    calendarMonth: playDay.slice(0, 7),
    calendarYear: Number(playDay.slice(0, 4)),
  };
}

// A rough correction is never placed on a day: it buckets to the coarsest
// calendar unit that contains the whole of its resolved range.
function coarseBucket(session: UnbucketedSession, timezone: string) {
  const earliest = DateTime.fromJSDate(session.estimatedStart, {
    zone: timezone,
  });
  const latest = DateTime.fromJSDate(session.estimatedEnd, { zone: timezone });
  if (earliest.year !== latest.year) {
    return { playDay: null, calendarMonth: null, calendarYear: null };
  }
  if (earliest.month !== latest.month) {
    return { playDay: null, calendarMonth: null, calendarYear: earliest.year };
  }
  return {
    playDay: null,
    calendarMonth: earliest.toFormat("yyyy-MM"),
    calendarYear: earliest.year,
  };
}

function bucketed(
  session: UnbucketedSession,
  settings: PlayDaySettings,
): DerivedSession {
  const { mergeable: _mergeable, ...rest } = session;
  if (session.correction && !session.anchored) {
    return { ...rest, ...coarseBucket(session, settings.timezone) };
  }
  const endsAt = session.correction
    ? session.estimatedEnd
    : session.endedBefore;
  return { ...rest, ...bucketOfPlayDay(playDayOf(endsAt, settings)) };
}

function correctionsBySnapshot(corrections: CorrectionInput[]) {
  const bySnapshot = new Map<number, CorrectionInput[]>();
  for (const correction of corrections) {
    if (correction.snapshotId === null) continue;
    const existing = bySnapshot.get(correction.snapshotId) ?? [];
    existing.push(correction);
    bySnapshot.set(correction.snapshotId, existing);
  }
  return bySnapshot;
}

function sumMinutes(corrections: CorrectionInput[]) {
  return corrections.reduce((total, { minutes }) => total + minutes, 0);
}

export function deriveTimeline(
  snapshots: PlaytimeSnapshot[],
  row: PlaytimeProviderRow,
  corrections: CorrectionInput[],
  settings: PlayDaySettings,
): DerivedTimeline {
  const bySnapshot = correctionsBySnapshot(corrections);
  const observed: UnbucketedSession[] = [];
  const corrected: UnbucketedSession[] = [];

  for (const delta of observeDeltas(snapshots)) {
    const applied =
      delta.snapshotId === null ? [] : (bySnapshot.get(delta.snapshotId) ?? []);
    if (applied.length === 0) {
      observed.push(toSession(delta, row, delta.minutes, true));
      continue;
    }
    for (const correction of applied) {
      corrected.push(toCorrectedSession(correction, row, settings.timezone));
    }
    const residual = delta.minutes - sumMinutes(applied);
    if (residual > 0) {
      observed.push(toSession(delta, row, residual, false));
    }
  }

  const baseline = baselineSnapshot(snapshots);
  const baselineCorrections =
    baseline?.id === undefined ? [] : (bySnapshot.get(baseline.id) ?? []);
  for (const correction of baselineCorrections) {
    corrected.push(toCorrectedSession(correction, row, settings.timezone));
  }
  const undatedMinutes = baseline
    ? Math.max(baseline.playtimeMinutes - sumMinutes(baselineCorrections), 0)
    : 0;

  for (const correction of corrections) {
    if (correction.snapshotId !== null) continue;
    corrected.push(toCorrectedSession(correction, row, settings.timezone));
  }

  return {
    sessions: [...mergeContiguousSessions(observed), ...corrected].map(
      (session) => bucketed(session, settings),
    ),
    undatedMinutes,
    baselineSnapshotId: baseline?.id ?? null,
  };
}

export function inferredLastPlayedAt(
  snapshots: PlaytimeSnapshot[],
): Date | null {
  return observeDeltas(snapshots).at(-1)?.endedBefore ?? null;
}
