import type { PlaytimeSessionJson } from "#shared/types/PlaytimeSession";
import { formatPlaytime } from "./formatPlaytime";

const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 1440;
const NEAR_EXACT_WINDOW_MINUTES = 15;

type SessionWindow = Pick<
  PlaytimeSessionJson,
  "minutes" | "endedAfter" | "endedBefore" | "estimatedStart" | "anchored"
> &
  Partial<Pick<PlaytimeSessionJson, "uncertaintyMinutes">>;

const sameYear = (date: Date, now: Date) =>
  date.getFullYear() === now.getFullYear();

function formatDate(date: Date, now: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear(date, now) ? {} : { year: "numeric" }),
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(date: Date, now: Date) {
  return `${formatDate(date, now)} ${formatTime(date)}`;
}

// `playDay` is a plain calendar date, so it is read as local midnight rather
// than through `new Date("YYYY-MM-DD")`, which parses as UTC.
export function formatSessionDay(playDay: string, now: Date) {
  const [year, month, day] = playDay.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear(date, now) ? {} : { year: "numeric" }),
  });
}

function windowMinutes(session: SessionWindow) {
  return (
    (new Date(session.endedBefore).getTime() -
      new Date(session.endedAfter).getTime()) /
    MILLISECONDS_PER_MINUTE
  );
}

export function formatSessionDuration(session: SessionWindow) {
  const duration = formatPlaytime(session.minutes) || "0m";
  return session.anchored ? duration : `~${duration}`;
}

export function formatSessionWindow(session: SessionWindow, now: Date) {
  const endedAfter = new Date(session.endedAfter);
  const endedBefore = new Date(session.endedBefore);
  if (session.anchored) {
    return `started ${formatDateTime(new Date(session.estimatedStart), now)}`;
  }
  const width = windowMinutes(session);
  if (width <= NEAR_EXACT_WINDOW_MINUTES) {
    const midpoint = new Date(
      (endedAfter.getTime() + endedBefore.getTime()) / 2,
    );
    return `ended around ${formatDateTime(midpoint, now)}`;
  }
  if (width < MINUTES_PER_DAY) {
    const sameDay = endedAfter.toDateString() === endedBefore.toDateString();
    if (sameDay) {
      return `ended between ${formatTime(endedAfter)} and ${formatTime(
        endedBefore,
      )} on ${formatDate(endedBefore, now)}`;
    }
    return `ended between ${formatDateTime(endedAfter, now)} and ${formatDateTime(
      endedBefore,
      now,
    )}`;
  }
  return `sometime between ${formatDate(endedAfter, now)} and ${formatDate(
    endedBefore,
    now,
  )}`;
}

export function formatObservationWindow(session: SessionWindow, now: Date) {
  return `Observed between ${formatDateTime(
    new Date(session.endedAfter),
    now,
  )} and ${formatDateTime(
    new Date(session.endedBefore),
    now,
  )}; the store only reports totals, so the exact time is unknown.`;
}

export function isLowConfidence(session: SessionWindow) {
  if (session.anchored) return false;
  const width = windowMinutes(session);
  const uncertainty = session.uncertaintyMinutes ?? width;
  return uncertainty > 2 * session.minutes || width > MINUTES_PER_DAY;
}
