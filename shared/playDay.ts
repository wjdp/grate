import { DateTime } from "luxon";

export interface PlayDaySettings {
  timezone: string;
  dayBoundaryHour: number;
}

// The day a moment belongs to when the day starts at `dayBoundaryHour` local
// time: a 01:00 session with a 06:00 boundary counts towards the day before.
export function playDayOf(instant: Date, settings: PlayDaySettings): string {
  const local = DateTime.fromJSDate(instant, { zone: settings.timezone });
  const day =
    local.hour < settings.dayBoundaryHour ? local.minus({ days: 1 }) : local;
  const date = day.toISODate();
  if (!date) throw new Error(`Cannot resolve play day for ${instant}`);
  return date;
}
