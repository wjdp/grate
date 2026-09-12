import { DateTime } from "luxon";

export type FuzzyDatePrecision = "year" | "month" | "day" | "minute";

export interface FuzzyDate {
  text: string;
  precision: FuzzyDatePrecision;
  approximate: boolean;
}

export interface ResolvedFuzzyDate {
  earliest: Date;
  latest: Date;
}

export interface ResolvedFuzzyDateRange extends ResolvedFuzzyDate {
  from: FuzzyDate;
  to: FuzzyDate;
  toEarliest: Date;
}

export class FuzzyDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FuzzyDateError";
  }
}

const FUZZY_DATE_PATTERN =
  /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2}))?)?)?(~)?$/;

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function partsOf(value: FuzzyDate): DateParts {
  const text = value.approximate ? value.text.slice(0, -1) : value.text;
  return {
    year: Number(text.slice(0, 4)),
    month: value.precision === "year" ? 1 : Number(text.slice(5, 7)),
    day:
      value.precision === "year" || value.precision === "month"
        ? 1
        : Number(text.slice(8, 10)),
    hour: value.precision === "minute" ? Number(text.slice(11, 13)) : 0,
    minute: value.precision === "minute" ? Number(text.slice(14, 16)) : 0,
  };
}

function localDateTime(parts: DateParts, timezone: string): DateTime {
  const local = DateTime.fromObject(parts, { zone: timezone });
  if (!local.isValid) {
    throw new FuzzyDateError(
      `Cannot resolve fuzzy date in timezone ${timezone}: ${local.invalidExplanation ?? local.invalidReason}`,
    );
  }
  return local;
}

function sameLocalTime(value: DateTime, parts: DateParts): boolean {
  return (
    value.year === parts.year &&
    value.month === parts.month &&
    value.day === parts.day &&
    value.hour === parts.hour &&
    value.minute === parts.minute
  );
}

function earliestPossibleInstant(value: DateTime): DateTime {
  return value
    .getPossibleOffsets()
    .reduce((earliest, possible) =>
      possible.toMillis() < earliest.toMillis() ? possible : earliest,
    );
}

export function parseFuzzyDate(text: string): FuzzyDate {
  const match = FUZZY_DATE_PATTERN.exec(text);
  if (!match) throw new FuzzyDateError(`Invalid fuzzy date: ${text}`);

  const [, yearText, monthText, dayText, hourText, minuteText, tilde] = match;
  const precision: FuzzyDatePrecision = hourText
    ? "minute"
    : dayText
      ? "day"
      : monthText
        ? "month"
        : "year";
  const month = Number(monthText ?? 1);
  const day = Number(dayText ?? 1);
  const hour = Number(hourText ?? 0);
  const minute = Number(minuteText ?? 0);
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) {
    throw new FuzzyDateError(`Invalid fuzzy date: ${text}`);
  }
  const candidate = DateTime.fromObject(
    {
      year: Number(yearText),
      month,
      day,
      hour,
      minute,
    },
    { zone: "UTC" },
  );

  if (!candidate.isValid)
    throw new FuzzyDateError(`Invalid fuzzy date: ${text}`);

  return { text, precision, approximate: tilde === "~" };
}

export function tryParseFuzzyDate(text: string): FuzzyDate | null {
  try {
    return parseFuzzyDate(text);
  } catch (error) {
    if (error instanceof FuzzyDateError) return null;
    throw error;
  }
}

export function isValidFuzzyDate(text: string): boolean {
  return tryParseFuzzyDate(text) !== null;
}

function asFuzzyDate(value: string | FuzzyDate): FuzzyDate {
  return typeof value === "string" ? parseFuzzyDate(value) : value;
}

export function resolveFuzzyDate(
  input: string | FuzzyDate,
  timezone: string,
): ResolvedFuzzyDate {
  const value = asFuzzyDate(input);
  const parts = partsOf(value);
  const local = localDateTime(parts, timezone);

  if (value.precision === "minute") {
    if (!sameLocalTime(local, parts)) {
      throw new FuzzyDateError(
        `${value.text} does not exist in timezone ${timezone}`,
      );
    }
    const instant = earliestPossibleInstant(local).toJSDate();
    return { earliest: instant, latest: instant };
  }

  const unit = value.precision === "day" ? "day" : value.precision;
  return {
    earliest: local.toJSDate(),
    latest: local.endOf(unit).toJSDate(),
  };
}

export function resolveFuzzyDateRange(
  fromInput: string | FuzzyDate,
  toInput: string | FuzzyDate,
  timezone: string,
): ResolvedFuzzyDateRange {
  const from = asFuzzyDate(fromInput);
  const to = asFuzzyDate(toInput);
  const { earliest } = resolveFuzzyDate(from, timezone);
  const { earliest: toEarliest, latest } = resolveFuzzyDate(to, timezone);

  if (latest < earliest) {
    throw new FuzzyDateError(
      `Fuzzy date range ends before it starts: ${from.text} to ${to.text}`,
    );
  }

  return { from, to, earliest, latest, toEarliest };
}

export function compareFuzzyDates(
  left: string | FuzzyDate,
  right: string | FuzzyDate,
): number {
  return asFuzzyDate(left).text.localeCompare(asFuzzyDate(right).text);
}

export function fuzzyDateRangesOverlap(
  left: ResolvedFuzzyDate,
  right: ResolvedFuzzyDate,
): boolean {
  const samePoint =
    left.earliest.getTime() === left.latest.getTime() &&
    right.earliest.getTime() === right.latest.getTime() &&
    left.earliest.getTime() === right.earliest.getTime();
  if (samePoint) return true;
  return left.earliest < right.latest && right.earliest < left.latest;
}

function displayDateTime(value: FuzzyDate): DateTime {
  return DateTime.fromObject(partsOf(value), { zone: "UTC" });
}

function withApproximation(value: FuzzyDate, formatted: string): string {
  return value.approximate ? `~${formatted}` : formatted;
}

export function formatFuzzyDate(input: string | FuzzyDate): string {
  const value = asFuzzyDate(input);
  const date = displayDateTime(value);
  const formatted =
    value.precision === "year"
      ? date.toFormat("yyyy")
      : value.precision === "month"
        ? date.toFormat("LLL yyyy")
        : value.precision === "day"
          ? date.toFormat("d LLL yyyy")
          : date.toFormat("ccc d LLL yyyy, HH:mm");
  return withApproximation(value, formatted);
}

export function formatFuzzyDateRange(
  fromInput: string | FuzzyDate,
  toInput: string | FuzzyDate,
): string {
  const from = asFuzzyDate(fromInput);
  const to = asFuzzyDate(toInput);
  if (from.text === to.text) return formatFuzzyDate(from);

  const fromDate = displayDateTime(from);
  const toDate = displayDateTime(to);
  const bothDays = from.precision === "day" && to.precision === "day";
  const sameMonth =
    fromDate.year === toDate.year && fromDate.month === toDate.month;
  if (bothDays && sameMonth) {
    return `${withApproximation(from, fromDate.toFormat("d"))}–${withApproximation(to, toDate.toFormat("d LLL yyyy"))}`;
  }

  const bothMinutes = from.precision === "minute" && to.precision === "minute";
  const sameDay = sameMonth && fromDate.day === toDate.day;
  if (bothMinutes && sameDay) {
    return `${withApproximation(from, fromDate.toFormat("ccc d LLL yyyy, HH:mm"))}–${withApproximation(to, toDate.toFormat("HH:mm"))}`;
  }

  return `${formatFuzzyDate(from)}–${formatFuzzyDate(to)}`;
}
