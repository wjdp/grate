import { describe, expect, it } from "vitest";
import {
  compareFuzzyDates,
  FuzzyDateError,
  formatFuzzyDate,
  formatFuzzyDateRange,
  fuzzyDateRangesOverlap,
  isValidFuzzyDate,
  parseFuzzyDate,
  resolveFuzzyDate,
  resolveFuzzyDateRange,
  tryParseFuzzyDate,
} from "./fuzzyDate";

describe("parseFuzzyDate", () => {
  it.each([
    ["2020", "year"],
    ["2020-10", "month"],
    ["2020-10-12", "day"],
    ["2020-10-12T20:05", "minute"],
  ] as const)("parses %s at %s precision", (text, precision) => {
    expect(parseFuzzyDate(text)).toEqual({
      text,
      precision,
      approximate: false,
    });
  });

  it("preserves canonical approximate input", () => {
    expect(parseFuzzyDate("2020-10~")).toEqual({
      text: "2020-10~",
      precision: "month",
      approximate: true,
    });
  });

  it.each([
    "",
    "20",
    "2020-1",
    "2020-01-1",
    "2020-01-01 12:00",
    "2020-01-01T1:00",
    "2020-01-01T12",
    "2020-01-01T12:00Z",
    "~2020",
    "2020~~",
    "2020-13",
    "2020-00",
    "2021-02-29",
    "2020-04-31",
    "2020-01-01T24:00",
    "2020-01-01T12:60",
  ])("rejects invalid input %s", (text) => {
    expect(() => parseFuzzyDate(text)).toThrow(FuzzyDateError);
    expect(tryParseFuzzyDate(text)).toBeNull();
    expect(isValidFuzzyDate(text)).toBe(false);
  });

  it("accepts a leap day", () => {
    expect(isValidFuzzyDate("2020-02-29")).toBe(true);
  });
});

describe("resolveFuzzyDate", () => {
  it.each([
    ["2020", "2020-01-01T00:00:00.000Z", "2020-12-31T23:59:59.999Z"],
    ["2020-02", "2020-02-01T00:00:00.000Z", "2020-02-29T23:59:59.999Z"],
    ["2020-10-12", "2020-10-12T00:00:00.000Z", "2020-10-12T23:59:59.999Z"],
    [
      "2020-10-12T20:05",
      "2020-10-12T20:05:00.000Z",
      "2020-10-12T20:05:00.000Z",
    ],
  ])("resolves %s in UTC", (text, earliest, latest) => {
    const resolved = resolveFuzzyDate(text, "UTC");
    expect(resolved.earliest.toISOString()).toBe(earliest);
    expect(resolved.latest.toISOString()).toBe(latest);
  });

  it("does not widen approximate values", () => {
    expect(resolveFuzzyDate("2020-10~", "UTC")).toEqual(
      resolveFuzzyDate("2020-10", "UTC"),
    );
  });

  it("resolves calendar bounds in the supplied timezone", () => {
    const resolved = resolveFuzzyDate("2020-07", "Europe/London");
    expect(resolved.earliest.toISOString()).toBe("2020-06-30T23:00:00.000Z");
    expect(resolved.latest.toISOString()).toBe("2020-07-31T22:59:59.999Z");
  });

  it("rejects an invalid timezone", () => {
    expect(() => resolveFuzzyDate("2020", "Europe/Nowhere")).toThrow(
      FuzzyDateError,
    );
  });

  it("rejects a minute in a spring-forward gap", () => {
    expect(() => resolveFuzzyDate("2024-03-31T01:30", "Europe/London")).toThrow(
      "does not exist",
    );
  });

  it("chooses the earlier occurrence of a minute in an autumn fold", () => {
    const resolved = resolveFuzzyDate("2024-10-27T01:30", "Europe/London");
    expect(resolved.earliest.toISOString()).toBe("2024-10-27T00:30:00.000Z");
    expect(resolved.latest).toEqual(resolved.earliest);
  });

  it("covers a London spring-forward day by its real duration", () => {
    const resolved = resolveFuzzyDate("2024-03-31", "Europe/London");
    expect(resolved.earliest.toISOString()).toBe("2024-03-31T00:00:00.000Z");
    expect(resolved.latest.toISOString()).toBe("2024-03-31T22:59:59.999Z");
  });

  it("covers a London autumn-fold day by its real duration", () => {
    const resolved = resolveFuzzyDate("2024-10-27", "Europe/London");
    expect(resolved.earliest.toISOString()).toBe("2024-10-26T23:00:00.000Z");
    expect(resolved.latest.toISOString()).toBe("2024-10-27T23:59:59.999Z");
  });
});

describe("resolveFuzzyDateRange", () => {
  it("uses the widest bounds of a mixed-precision pair", () => {
    const range = resolveFuzzyDateRange(
      "2020-10-12T20:00",
      "2020-10-13",
      "UTC",
    );
    expect(range.earliest.toISOString()).toBe("2020-10-12T20:00:00.000Z");
    expect(range.latest.toISOString()).toBe("2020-10-13T23:59:59.999Z");
    expect(range.from.precision).toBe("minute");
    expect(range.to.precision).toBe("day");
  });

  it("reports the earliest instant the end date could fall on", () => {
    const range = resolveFuzzyDateRange("2020-10-25", "2020-10-30", "UTC");
    expect(range.toEarliest.toISOString()).toBe("2020-10-30T00:00:00.000Z");
    expect(range.latest.toISOString()).toBe("2020-10-30T23:59:59.999Z");

    const minutes = resolveFuzzyDateRange(
      "2020-10-30T19:00",
      "2020-10-30T20:10",
      "UTC",
    );
    expect(minutes.toEarliest.toISOString()).toBe(minutes.latest.toISOString());
  });

  it("rejects a reversed range after resolution", () => {
    expect(() => resolveFuzzyDateRange("2020-11", "2020-10", "UTC")).toThrow(
      "ends before it starts",
    );
  });
});

describe("comparison", () => {
  it("sorts canonical values lexicographically", () => {
    const values = ["2021", "2020-11", "2020-02", "2020"];
    expect(values.sort(compareFuzzyDates)).toEqual([
      "2020",
      "2020-02",
      "2020-11",
      "2021",
    ]);
  });

  it("detects overlap using widest resolved bounds", () => {
    const june = resolveFuzzyDateRange("2024-06", "2024-06", "UTC");
    const day = resolveFuzzyDateRange(
      "2024-06-15T10:00",
      "2024-06-15T11:00",
      "UTC",
    );
    expect(fuzzyDateRangesOverlap(june, day)).toBe(true);
  });

  it("allows ranges that only touch", () => {
    const left = resolveFuzzyDateRange(
      "2024-06-15T10:00",
      "2024-06-15T11:00",
      "UTC",
    );
    const right = resolveFuzzyDateRange(
      "2024-06-15T11:00",
      "2024-06-15T12:00",
      "UTC",
    );
    expect(fuzzyDateRangesOverlap(left, right)).toBe(false);
  });

  it("treats two identical exact-minute points as overlapping", () => {
    const left = resolveFuzzyDateRange(
      "2024-06-15T11:00",
      "2024-06-15T11:00",
      "UTC",
    );
    const right = resolveFuzzyDateRange(
      "2024-06-15T11:00",
      "2024-06-15T11:00",
      "UTC",
    );
    expect(fuzzyDateRangesOverlap(left, right)).toBe(true);
  });
});

describe("formatting", () => {
  it.each([
    ["2020", "2020"],
    ["2020-10", "Oct 2020"],
    ["2020-10-12", "12 Oct 2020"],
    ["2020-10-12T20:00", "Mon 12 Oct 2020, 20:00"],
    ["2020-10~", "~Oct 2020"],
  ])("formats %s", (text, expected) => {
    expect(formatFuzzyDate(text)).toBe(expected);
  });

  it("contracts a same-month day range", () => {
    expect(formatFuzzyDateRange("2020-10-12", "2020-10-30")).toBe(
      "12–30 Oct 2020",
    );
  });

  it("contracts an exact same-day range", () => {
    expect(formatFuzzyDateRange("2020-10-12T20:00", "2020-10-12T23:52")).toBe(
      "Mon 12 Oct 2020, 20:00–23:52",
    );
  });

  it("keeps approximation markers on range endpoints", () => {
    expect(formatFuzzyDateRange("2020-10-12~", "2020-10-30~")).toBe(
      "~12–~30 Oct 2020",
    );
  });
});
