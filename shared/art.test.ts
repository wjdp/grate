import { describe, expect, it } from "vitest";
import {
  getGameArtUrls,
  resolveEpicImageUrl,
  resolveGogImageUrl,
} from "#shared/art";
import type { GameWithProviders } from "#shared/types/Game";

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

const makeGame = (rows: Record<string, unknown>): GameWithProviders =>
  ({
    id: 1,
    name: "Test Game",
    steamGames: [],
    gogGames: [],
    epicGames: [],
    ...rows,
  }) as unknown as GameWithProviders;

const steamRow = { appId: 620, name: "Portal 2" };

const gogRow = {
  gogId: 1207658930,
  name: "Baldur's Gate",
  iconUrl: `https://images.gog-statics.com/${GOG_HASH}.png`,
  iconSquareUrl: `https://images.gog-statics.com/${GOG_SQUARE_ICON_HASH}.png`,
  logoUrl: `https://images.gog-statics.com/${GOG_JPG_HASH}.jpg`,
  boxArtImageUrl: `https://images.gog-statics.com/${GOG_HASH}.png`,
  backgroundImageUrl: `https://images.gog-statics.com/${GOG_JPG_HASH}.jpg`,
  galaxyBackgroundImageUrl: `https://images.gog-statics.com/${GOG_HASH}.jpg`,
};

const epicRow = {
  epicId: 7,
  name: "Alan Wake",
  boxArtTallUrl: EPIC_BOX_ART,
  boxArtWideUrl:
    "https://cdn1.epicgames.com/offer/fn/Fortnite_DieselGameBoxWide.jpg",
  logoUrl: "https://cdn1.epicgames.com/offer/fn/Fortnite_DieselGameBoxLogo.png",
};

describe("getGameArtUrls", () => {
  it("returns null when the game has no provider rows", () => {
    expect(getGameArtUrls(makeGame({}))).toBeNull();
  });

  it("builds steam route urls, mapping background to the backdrop type", () => {
    expect(getGameArtUrls(makeGame({ steamGames: [steamRow] }))).toEqual({
      icon: "/art/steam/620/icon",
      poster: "/art/steam/620/poster",
      hero: "/art/steam/620/hero",
      background: "/art/steam/620/backdrop",
      logo: "/art/steam/620/logo",
    });
  });

  it("prefers steam over gog and epic", () => {
    const art = getGameArtUrls(
      makeGame({
        steamGames: [steamRow],
        gogGames: [gogRow],
        epicGames: [epicRow],
      }),
    );
    expect(art?.poster).toBe("/art/steam/620/poster");
  });

  it("prefers gog over epic", () => {
    const art = getGameArtUrls(
      makeGame({ gogGames: [gogRow], epicGames: [epicRow] }),
    );
    expect(art?.poster).toBe("/art/gog/1207658930/poster");
  });

  it("builds gog route urls when the backing columns are present", () => {
    expect(getGameArtUrls(makeGame({ gogGames: [gogRow] }))).toEqual({
      icon: "/art/gog/1207658930/icon",
      poster: "/art/gog/1207658930/poster",
      hero: "/art/gog/1207658930/hero",
      background: "/art/gog/1207658930/background",
      logo: "/art/gog/1207658930/logo",
    });
  });

  it("emits null for gog types whose columns are empty or absent", () => {
    expect(
      getGameArtUrls(
        makeGame({
          gogGames: [
            {
              ...gogRow,
              iconUrl: "",
              iconSquareUrl: "",
              logoUrl: null,
              boxArtImageUrl: null,
              backgroundImageUrl: "",
              galaxyBackgroundImageUrl: null,
            },
          ],
        }),
      ),
    ).toEqual({
      icon: null,
      poster: null,
      hero: null,
      background: null,
      logo: null,
    });
  });

  it("falls back to the plain gog icon and background columns", () => {
    const art = getGameArtUrls(
      makeGame({
        gogGames: [
          {
            ...gogRow,
            iconSquareUrl: "",
            galaxyBackgroundImageUrl: null,
          },
        ],
      }),
    );
    expect(art?.icon).toBe("/art/gog/1207658930/icon");
    expect(art?.background).toBe("/art/gog/1207658930/background");
  });

  it("builds epic route urls when the backing columns are present", () => {
    expect(getGameArtUrls(makeGame({ epicGames: [epicRow] }))).toEqual({
      icon: "/art/epic/7/icon",
      poster: "/art/epic/7/poster",
      hero: "/art/epic/7/hero",
      background: "/art/epic/7/background",
      logo: "/art/epic/7/logo",
    });
  });

  it("emits null for epic types whose columns are absent", () => {
    expect(
      getGameArtUrls(
        makeGame({
          epicGames: [
            {
              ...epicRow,
              boxArtTallUrl: null,
              boxArtWideUrl: null,
              logoUrl: "",
            },
          ],
        }),
      ),
    ).toEqual({
      icon: null,
      poster: null,
      hero: null,
      background: null,
      logo: null,
    });
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
