import type {
  PlaytimeProvider,
  PlaytimeSession,
} from "#shared/types/PlaytimeSession";

const MILLISECONDS_PER_MINUTE = 60_000;

// Steam flushes a game's total every hour or so, so one sitting arrives as a
// run of anchored deltas whose ends and starts meet. Flush timing jitters by a
// second or two; this absorbs that without joining genuinely separate sittings.
const CONTIGUOUS_ANCHOR_TOLERANCE_MINUTES = 5;

// Which play day a session falls on depends on user settings, so the pure
// derivation leaves `playDay` to its caller.
export type DerivedSession = Omit<PlaytimeSession, "playDay">;

export interface PlaytimeSnapshot {
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

interface ObservedDelta {
  minutes: number;
  endedAfter: Date;
  endedBefore: Date;
  lastPlayedAnchor: number | null;
  previousLastPlayedAnchor: number | null;
  playedOffline: boolean;
}

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

function observeDeltas(snapshots: PlaytimeSnapshot[]): ObservedDelta[] {
  const ordered = [...snapshots].sort(byObservationOrder);
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
): DerivedSession {
  const bounds = {
    ...row,
    minutes: delta.minutes,
    endedAfter: delta.endedAfter,
    endedBefore: delta.endedBefore,
  };
  const lastPlayed = changedLastPlayed(delta, row.provider);
  if (lastPlayed && !delta.playedOffline) {
    return {
      ...bounds,
      estimatedStart: new Date(
        lastPlayed.getTime() - delta.minutes * MILLISECONDS_PER_MINUTE,
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
        estimatedEnd.getTime() - delta.minutes * MILLISECONDS_PER_MINUTE,
      ),
      estimatedEnd,
      uncertaintyMinutes: widerOfWindowAndSession(windowMinutes, delta.minutes),
      anchored: false,
    };
  }
  const estimatedStart =
    row.provider === "steam"
      ? delta.endedAfter
      : new Date(
          delta.endedBefore.getTime() - delta.minutes * MILLISECONDS_PER_MINUTE,
        );
  return {
    ...bounds,
    estimatedStart,
    estimatedEnd: delta.endedBefore,
    uncertaintyMinutes: widerOfWindowAndSession(windowMinutes, delta.minutes),
    anchored: false,
  };
}

// An unanchored delta carries no evidence that it continues the previous one,
// and GOG/Epic already report one delta per completed session.
function continuesPrevious(previous: DerivedSession, next: DerivedSession) {
  if (!previous.anchored || !next.anchored) {
    return false;
  }
  const gapMinutes =
    Math.abs(next.estimatedStart.getTime() - previous.estimatedEnd.getTime()) /
    MILLISECONDS_PER_MINUTE;
  return gapMinutes <= CONTIGUOUS_ANCHOR_TOLERANCE_MINUTES;
}

function mergeContiguousSessions(sessions: DerivedSession[]) {
  return sessions.reduce<DerivedSession[]>((merged, session) => {
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
    };
    return merged;
  }, []);
}

export function deriveSessions(
  snapshots: PlaytimeSnapshot[],
  row: PlaytimeProviderRow,
): DerivedSession[] {
  return mergeContiguousSessions(
    observeDeltas(snapshots).map((delta) => toSession(delta, row)),
  );
}

export function inferredLastPlayedAt(
  snapshots: PlaytimeSnapshot[],
): Date | null {
  return observeDeltas(snapshots).at(-1)?.endedBefore ?? null;
}
