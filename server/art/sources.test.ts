import { describe, expect, it } from "vitest";
import { resolveArtSources } from "./sources";

describe("resolveArtSources for steam", () => {
  it("falls back from 2x library art to 1x to the header capsule", async () => {
    const candidates = await resolveArtSources({
      provider: "steam",
      id: 201870,
      type: "poster",
    });
    expect(candidates.map((candidate) => candidate.url)).toEqual([
      "https://steamcdn-a.akamaihd.net/steam/apps/201870/library_600x900_2x.jpg",
      "https://steamcdn-a.akamaihd.net/steam/apps/201870/library_600x900.jpg",
      "https://steamcdn-a.akamaihd.net/steam/apps/201870/header.jpg",
    ]);
  });

  it("offers a single candidate for other convention-derived types", async () => {
    const candidates = await resolveArtSources({
      provider: "steam",
      id: 201870,
      type: "hero",
    });
    expect(candidates).toEqual([
      {
        url: "https://steamcdn-a.akamaihd.net/steam/apps/201870/library_hero.jpg",
      },
    ]);
  });
});
