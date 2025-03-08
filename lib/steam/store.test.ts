import { describe, expect, it } from "vitest";
import { parseReleaseDate } from "./store";

describe("parseReleaseDate", () => {
  it("should return a Date object for a valid steam release date", () => {
    const date = parseReleaseDate("25 Mar, 2013");
    expect(date).toBeInstanceOf(Date);
    expect(date.getFullYear()).toBe(2013);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(25);
  });
});
