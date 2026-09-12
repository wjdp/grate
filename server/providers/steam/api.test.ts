import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import createFetchMock from "vitest-fetch-mock";
import { getCommunityProfile, getUserGames, SteamApiError } from "./api";

const FIXTURE_STEAM_ID = "76561198032111175";

const communityProfileXml = readFileSync(
  join(import.meta.dirname, "fixtures/community-profile.xml"),
  "utf8",
);

const fetchMocker = createFetchMock(vi);
fetchMocker.enableMocks();

beforeEach(() => {
  fetchMocker.resetMocks();
});
afterAll(() => {
  fetchMocker.disableMocks();
});

describe("getCommunityProfile", () => {
  it("parses the community xml document", async () => {
    fetchMocker.mockResponseOnce(communityProfileXml);
    const profile = await getCommunityProfile({ steamId: FIXTURE_STEAM_ID });
    expect(profile).toEqual({
      steamID64: FIXTURE_STEAM_ID,
      steamID: "fixture-persona",
      avatarIcon: "https://avatars.akamai.steamstatic.com/fixture.jpg",
      avatarMedium: "https://avatars.akamai.steamstatic.com/fixture_medium.jpg",
      avatarFull: "https://avatars.akamai.steamstatic.com/fixture_full.jpg",
      realname: "Fixture Person",
      customURL: "fixture",
    });
    expect(fetchMocker.requests()[0].url).toBe(
      `https://steamcommunity.com/profiles/${FIXTURE_STEAM_ID}/?xml=1`,
    );
  });

  it("keeps the 64-bit steam id exact", async () => {
    fetchMocker.mockResponseOnce(communityProfileXml);
    const profile = await getCommunityProfile({ steamId: FIXTURE_STEAM_ID });
    expect(profile.steamID64).toBe(FIXTURE_STEAM_ID);
  });

  it("treats an empty custom url as absent", async () => {
    fetchMocker.mockResponseOnce(
      communityProfileXml.replace(
        "<customURL><![CDATA[fixture]]></customURL>",
        "<customURL><![CDATA[]]></customURL>",
      ),
    );
    const profile = await getCommunityProfile({ steamId: FIXTURE_STEAM_ID });
    expect(profile.customURL).toBeNull();
  });

  it("throws for a private profile error document", async () => {
    fetchMocker.mockResponseOnce(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><response><error><![CDATA[The specified profile could not be found.]]></error></response>`,
    );
    await expect(
      getCommunityProfile({ steamId: FIXTURE_STEAM_ID }),
    ).rejects.toThrow("The specified profile could not be found.");
  });

  it("looks a vanity name up by its community url", async () => {
    fetchMocker.mockResponseOnce(communityProfileXml);
    const profile = await getCommunityProfile({ vanityName: "fixture" });
    expect(profile.steamID64).toBe(FIXTURE_STEAM_ID);
    expect(fetchMocker.requests()[0].url).toBe(
      "https://steamcommunity.com/id/fixture/?xml=1",
    );
  });

  it("names the vanity in the no-profile error", async () => {
    fetchMocker.mockResponseOnce(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><profiles></profiles>`,
    );
    await expect(getCommunityProfile({ vanityName: "nobody" })).rejects.toThrow(
      'Steam returned no profile for vanity name "nobody"',
    );
  });

  it("throws for a non-200 response", async () => {
    fetchMocker.mockResponseOnce("", { status: 500 });
    await expect(
      getCommunityProfile({ steamId: FIXTURE_STEAM_ID }),
    ).rejects.toThrow(SteamApiError);
  });
});

describe("getUserGames", () => {
  it("sends the api key as a query parameter", async () => {
    fetchMocker.mockResponseOnce(
      JSON.stringify({ response: { game_count: 0, games: [] } }),
    );
    await getUserGames({ apiKey: "API-KEY", steamId: FIXTURE_STEAM_ID });
    const url = new URL(fetchMocker.requests()[0].url);
    expect(url.searchParams.get("key")).toBe("API-KEY");
    expect(url.searchParams.get("access_token")).toBeNull();
    expect(url.searchParams.get("steamid")).toBe(FIXTURE_STEAM_ID);
    expect(url.searchParams.get("include_appinfo")).toBe("1");
    expect(url.searchParams.get("include_played_free_games")).toBe("1");
    expect(url.searchParams.get("include_extended_appinfo")).toBe("1");
  });
});
