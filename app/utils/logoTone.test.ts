import { describe, expect, it } from "vitest";
import {
  isDarkLogo,
  LOGO_DARK_LUMINANCE,
  opaqueMeanLuminance,
} from "./logoTone";

function pixels(...values: number[]): Uint8ClampedArray {
  return new Uint8ClampedArray(values);
}

describe("opaqueMeanLuminance", () => {
  it("ignores transparent padding", () => {
    const opaqueWhite = [255, 255, 255, 255];
    const transparentWhite = [255, 255, 255, 0];
    const opaqueBlack = [0, 0, 0, 255];
    expect(
      opaqueMeanLuminance(
        pixels(...transparentWhite, ...opaqueBlack, ...transparentWhite),
      ),
    ).toBe(0);
    expect(
      opaqueMeanLuminance(pixels(...opaqueWhite, ...opaqueBlack)),
    ).toBeCloseTo(127.5);
  });

  it("ignores barely opaque antialiasing", () => {
    expect(opaqueMeanLuminance(pixels(255, 255, 255, 128, 0, 0, 0, 255))).toBe(
      0,
    );
  });

  it("weights channels by perceived brightness", () => {
    expect(opaqueMeanLuminance(pixels(255, 0, 0, 255))).toBeCloseTo(
      0.2126 * 255,
    );
  });

  it("is null when nothing is opaque", () => {
    expect(opaqueMeanLuminance(pixels(255, 255, 255, 0))).toBeNull();
    expect(opaqueMeanLuminance(pixels())).toBeNull();
  });
});

describe("isDarkLogo", () => {
  it("is true for a dark wordmark", () => {
    expect(isDarkLogo(36)).toBe(true);
    expect(isDarkLogo(LOGO_DARK_LUMINANCE - 1)).toBe(true);
  });

  it("is false for a light wordmark", () => {
    expect(isDarkLogo(LOGO_DARK_LUMINANCE)).toBe(false);
    expect(isDarkLogo(230)).toBe(false);
  });

  it("is false when the logo could not be measured", () => {
    expect(isDarkLogo(null)).toBe(false);
  });
});
