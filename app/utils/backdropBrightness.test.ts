import { describe, expect, it } from "vitest";
import {
  BACKDROP_MIN_BRIGHTNESS,
  backdropBrightness,
  meanLuminance,
} from "./backdropBrightness";

describe("backdropBrightness", () => {
  it("dims bright backdrops by the full amount", () => {
    expect(backdropBrightness(190)).toBe(BACKDROP_MIN_BRIGHTNESS);
    expect(backdropBrightness(96)).toBe(BACKDROP_MIN_BRIGHTNESS);
  });

  it("leaves already dark backdrops alone", () => {
    expect(backdropBrightness(48)).toBe(1);
    expect(backdropBrightness(20)).toBe(1);
    expect(backdropBrightness(0)).toBe(1);
  });

  it("eases the dimming off between the two", () => {
    expect(backdropBrightness(64)).toBeCloseTo(0.75);
  });
});

describe("meanLuminance", () => {
  it("weights channels by perceived brightness", () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
    expect(meanLuminance(pixels)).toBeCloseTo(
      (0.2126 * 255 + 0.0722 * 255) / 2,
    );
  });

  it("is zero for no pixels", () => {
    expect(meanLuminance(new Uint8ClampedArray())).toBe(0);
  });
});
