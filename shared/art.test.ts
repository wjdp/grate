import { describe, it, expect } from "vitest";
import {
  getGogIconUrl,
  resolveEpicImageUrl,
  resolveGogImageUrl,
} from "#shared/art";

const GOG_HASH =
  "e743fa32a4d83f522e01b9bbbb95d2a8173cb3d4bdbafdcc5b6292afc5ed7783";
const GOG_JPG_HASH =
  "de8d0a351e573110f76100fa188a278b196debd10e8f757fc1457e558955de43";
const GOG_SQUARE_ICON_HASH =
  "66bcbfedf4273e46d26e72e639c6335d95221579dcaedcd8a3f651aa02215e4a";

const EPIC_BOX_ART =
  "https://cdn1.epicgames.com/offer/fn/Fortnite_DieselGameBoxTall.jpg";

describe("resolveGogImageUrl", () => {
  it("substitutes the formatter and extension in a templated href", () => {
    expect(
      resolveGogImageUrl(
        `https://images.gog.com/${GOG_HASH}_{formatter}.{ext}`,
        "glx_logo_2x",
      ),
    ).toBe(`https://images.gog.com/${GOG_HASH}_glx_logo_2x.png`);
  });

  it("appends the formatter to a bare png hash url", () => {
    expect(
      resolveGogImageUrl(
        `https://images.gog-statics.com/${GOG_HASH}.png`,
        "glx_square_icon_v2",
      ),
    ).toBe(`https://images.gog-statics.com/${GOG_HASH}_glx_square_icon_v2.png`);
  });

  it("keeps the original extension on a bare jpg hash url", () => {
    expect(
      resolveGogImageUrl(
        `https://images.gog-statics.com/${GOG_JPG_HASH}.jpg`,
        "glx_logo_2x",
      ),
    ).toBe(`https://images.gog-statics.com/${GOG_JPG_HASH}_glx_logo_2x.jpg`);
  });

  it("returns null for absent urls", () => {
    expect(resolveGogImageUrl(null, "glx_logo_2x")).toBeNull();
    expect(resolveGogImageUrl(undefined, "glx_logo_2x")).toBeNull();
    expect(resolveGogImageUrl("", "glx_logo_2x")).toBeNull();
  });

  it("returns an extensionless url unchanged", () => {
    expect(
      resolveGogImageUrl("https://images.gog-statics.com/", "glx_logo_2x"),
    ).toBe("https://images.gog-statics.com/");
  });
});

describe("getGogIconUrl", () => {
  it("prefers the square icon", () => {
    expect(
      getGogIconUrl({
        iconSquareUrl: `https://images.gog-statics.com/${GOG_SQUARE_ICON_HASH}.png`,
        iconUrl: `https://images.gog-statics.com/${GOG_HASH}.png`,
      }),
    ).toBe(
      `https://images.gog-statics.com/${GOG_SQUARE_ICON_HASH}_glx_square_icon_v2.png`,
    );
  });

  it("falls back to the plain icon when the square icon is absent", () => {
    expect(
      getGogIconUrl({
        iconSquareUrl: null,
        iconUrl: `https://images.gog-statics.com/${GOG_HASH}.png`,
      }),
    ).toBe(`https://images.gog-statics.com/${GOG_HASH}_glx_square_icon_v2.png`);
  });

  it("falls back when the square icon is an empty string", () => {
    expect(
      getGogIconUrl({
        iconSquareUrl: "",
        iconUrl: `https://images.gog-statics.com/${GOG_HASH}.png`,
      }),
    ).toBe(`https://images.gog-statics.com/${GOG_HASH}_glx_square_icon_v2.png`);
  });

  it("returns null when neither icon is present", () => {
    expect(getGogIconUrl({ iconSquareUrl: null, iconUrl: null })).toBeNull();
  });
});

describe("resolveEpicImageUrl", () => {
  it("appends a width", () => {
    expect(resolveEpicImageUrl(EPIC_BOX_ART, { w: 256 })).toBe(
      `${EPIC_BOX_ART}?w=256&resize=1`,
    );
  });

  it("appends a height", () => {
    expect(resolveEpicImageUrl(EPIC_BOX_ART, { h: 128 })).toBe(
      `${EPIC_BOX_ART}?h=128&resize=1`,
    );
  });

  it("appends both dimensions", () => {
    expect(resolveEpicImageUrl(EPIC_BOX_ART, { w: 256, h: 342 })).toBe(
      `${EPIC_BOX_ART}?w=256&h=342&resize=1`,
    );
  });

  it("leaves the url untouched when no dimensions are given", () => {
    expect(resolveEpicImageUrl(EPIC_BOX_ART, {})).toBe(EPIC_BOX_ART);
  });

  it("returns null for absent urls", () => {
    expect(resolveEpicImageUrl(null, { w: 256 })).toBeNull();
    expect(resolveEpicImageUrl(undefined, { w: 256 })).toBeNull();
  });
});
