import type {
  PlaytimeProvider,
  PlaytimeSession,
} from "#shared/types/PlaytimeSession";

const MILLISECONDS_PER_MINUTE = 60_000;

// Which play day a session falls on depends on user settings, so the pure
// derivation leaves `playDay` to its caller.
export type DerivedSession = Omit<PlaytimeSession, "playDay">;

export interface PlaytimeSnapshot {
  timestampStart: Date | null;
  timestampEnd: Date;
  playtimeMinutes: number;
  rTimeLastPlayed?: number | null;
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
    });
  }
  return deltas;
}

function anchoredStart(
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
  const anchor = anchoredStart(delta, row.provider);
  if (anchor) {
    return {
      ...bounds,
      estimatedStart: anchor,
      estimatedEnd: new Date(
        anchor.getTime() + delta.minutes * MILLISECONDS_PER_MINUTE,
      ),
      uncertaintyMinutes: 0,
      anchored: true,
    };
  }
  const windowMinutes =
    (delta.endedBefore.getTime() - delta.endedAfter.getTime()) /
    MILLISECONDS_PER_MINUTE;
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

export function deriveSessions(
  snapshots: PlaytimeSnapshot[],
  row: PlaytimeProviderRow,
): DerivedSession[] {
  return observeDeltas(snapshots).map((delta) => toSession(delta, row));
}

export function inferredLastPlayedAt(
  snapshots: PlaytimeSnapshot[],
): Date | null {
  return observeDeltas(snapshots).at(-1)?.endedBefore ?? null;
}
