import { describe, expect, it } from "vitest";
import { getPrimaryLaunch } from "#shared/providers";

const steamRow = { appId: 620 };
const gogRow = { gogId: 1207658930 };
const epicRowWithSlug = {
  namespace: "ns",
  catalogItemId: "item",
  appName: "AlanWake",
  storeSlug: "alan-wake",
};
const epicRowWithoutSlug = {
  namespace: "ns",
  catalogItemId: "item",
  appName: "AlanWake",
  storeSlug: null,
};

describe("getPrimaryLaunch", () => {
  it("returns null when there are no provider rows", () => {
    expect(
      getPrimaryLaunch({ steamGames: [], gogGames: [], epicGames: [] }),
    ).toBeNull();
  });

  it("treats null playtimes as zero", () => {
    const result = getPrimaryLaunch({
      steamGames: [{ ...steamRow, playtimeForever: null }],
      gogGames: [],
      epicGames: [],
    });
    expect(result?.playtimeMinutes).toBe(0);
  });

  it("picks the most-played row across providers", () => {
    const result = getPrimaryLaunch({
      steamGames: [{ ...steamRow, playtimeForever: 100 }],
      gogGames: [{ ...gogRow, playtimeMinutes: 500 }],
      epicGames: [{ ...epicRowWithoutSlug, playtimeMinutes: 200 }],
    });
    expect(result).toEqual({
      playtimeMinutes: 500,
      openUrl: "goggalaxy://openGameView/1207658930",
      playUrl: "goggalaxy://runGame/1207658930",
    });
  });

  it("returns steam links when steam wins", () => {
    const result = getPrimaryLaunch({
      steamGames: [{ ...steamRow, playtimeForever: 900 }],
      gogGames: [{ ...gogRow, playtimeMinutes: 500 }],
      epicGames: [],
    });
    expect(result).toEqual({
      playtimeMinutes: 900,
      openUrl: "steam://nav/games/details/620",
      playUrl: "steam://run/620",
    });
  });

  it("uses the epic store page as openUrl when a storeSlug is present", () => {
    const result = getPrimaryLaunch({
      steamGames: [],
      gogGames: [],
      epicGames: [{ ...epicRowWithSlug, playtimeMinutes: 50 }],
    });
    expect(result?.openUrl).toBe("https://store.epicgames.com/p/alan-wake");
    expect(result?.playUrl).toBe(
      "com.epicgames.launcher://apps/ns%3Aitem%3AAlanWake?action=launch&silent=true",
    );
  });

  it("falls back to the play url as openUrl when no storeSlug is present", () => {
    const result = getPrimaryLaunch({
      steamGames: [],
      gogGames: [],
      epicGames: [{ ...epicRowWithoutSlug, playtimeMinutes: 50 }],
    });
    expect(result?.openUrl).toBe(result?.playUrl);
  });
});
