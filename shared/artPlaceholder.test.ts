import { describe, expect, it } from "vitest";
import {
  formatHsl,
  getPlaceholderColour,
  getPlaceholderColourCss,
} from "#shared/artPlaceholder";

describe("getPlaceholderColour", () => {
  it("is deterministic for a given name", () => {
    expect(getPlaceholderColour("Portal 2")).toEqual(
      getPlaceholderColour("Portal 2"),
    );
  });

  it("keeps the hue in range and the saturation and lightness muted", () => {
    for (const name of [
      "",
      "a",
      "Baldur's Gate",
      "Sid Meier's Civilization VI",
    ]) {
      const { h, s, l } = getPlaceholderColour(name);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
      expect(Number.isInteger(h)).toBe(true);
      expect(s).toBeLessThanOrEqual(40);
      expect(l).toBeLessThanOrEqual(35);
    }
  });

  it("spreads distinct names across distinct hues", () => {
    // Random-ish hues collide by the birthday problem: 100 names over 360
    // hues leave around 87 distinct on average.
    const names = Array.from({ length: 100 }, (_, index) => `Game ${index}`);
    const hues = new Set(names.map((name) => getPlaceholderColour(name).h));
    expect(hues.size).toBeGreaterThan(75);
  });

  it("gives different names different hues", () => {
    expect(getPlaceholderColour("Portal 2").h).not.toBe(
      getPlaceholderColour("Half-Life 2").h,
    );
  });
});

describe("getPlaceholderColourCss", () => {
  it("formats the derived colour as an hsl string", () => {
    const colour = getPlaceholderColour("Portal 2");
    expect(getPlaceholderColourCss("Portal 2")).toBe(formatHsl(colour));
    expect(getPlaceholderColourCss("Portal 2")).toBe(
      `hsl(${colour.h}, ${colour.s}%, ${colour.l}%)`,
    );
  });
});
