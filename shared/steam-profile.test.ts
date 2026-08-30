import { describe, it, expect } from "vitest";
import { parseSteamProfileInput } from "#shared/steam-profile";

const STEAM_ID = "76561197960435530";

describe("parseSteamProfileInput", () => {
  it("accepts a bare SteamID64", () => {
    expect(parseSteamProfileInput(STEAM_ID)).toStrictEqual({
      steamId: STEAM_ID,
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseSteamProfileInput(`  ${STEAM_ID}\n`)).toStrictEqual({
      steamId: STEAM_ID,
    });
    expect(parseSteamProfileInput(" robinwalker ")).toStrictEqual({
      vanityName: "robinwalker",
    });
  });

  it("accepts a profiles URL", () => {
    expect(
      parseSteamProfileInput(`https://steamcommunity.com/profiles/${STEAM_ID}`),
    ).toStrictEqual({ steamId: STEAM_ID });
  });

  it("accepts a profiles URL with a trailing slash, path and www", () => {
    expect(
      parseSteamProfileInput(
        `http://www.steamcommunity.com/profiles/${STEAM_ID}/`,
      ),
    ).toStrictEqual({ steamId: STEAM_ID });
    expect(
      parseSteamProfileInput(
        `https://steamcommunity.com/profiles/${STEAM_ID}/games/?tab=all`,
      ),
    ).toStrictEqual({ steamId: STEAM_ID });
  });

  it("accepts a vanity URL", () => {
    expect(
      parseSteamProfileInput("https://steamcommunity.com/id/robinwalker"),
    ).toStrictEqual({ vanityName: "robinwalker" });
  });

  it("accepts a vanity URL with a trailing slash, path and www", () => {
    expect(
      parseSteamProfileInput("http://www.steamcommunity.com/id/robinwalker/"),
    ).toStrictEqual({ vanityName: "robinwalker" });
    expect(
      parseSteamProfileInput(
        "https://steamcommunity.com/id/robinwalker/games/?tab=all",
      ),
    ).toStrictEqual({ vanityName: "robinwalker" });
  });

  it("accepts a bare vanity name", () => {
    expect(parseSteamProfileInput("robin_walker-1")).toStrictEqual({
      vanityName: "robin_walker-1",
    });
  });

  it("rejects unparseable input", () => {
    expect(parseSteamProfileInput("")).toBeNull();
    expect(parseSteamProfileInput("   ")).toBeNull();
    expect(parseSteamProfileInput("a")).toBeNull();
    expect(parseSteamProfileInput("has spaces")).toBeNull();
    expect(parseSteamProfileInput("a".repeat(33))).toBeNull();
    expect(parseSteamProfileInput("https://example.com/id/robin")).toBeNull();
    expect(
      parseSteamProfileInput("https://steamcommunity.com/profiles/123"),
    ).toBeNull();
    expect(parseSteamProfileInput("https://steamcommunity.com/id/")).toBeNull();
  });
});
