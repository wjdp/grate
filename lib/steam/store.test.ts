import createFetchMock from "vitest-fetch-mock";
import { vi, beforeEach, describe, expect, it, afterAll } from "vitest";
import { getAppDetails, parseReleaseDate, SteamStoreError } from "./store";

import Response7670 from "./fixtures/store/7670.json";
import Response443080 from "./fixtures/store/443080.json";

const BIOSHOCK_APP_ID = 7670;
const INVALID_APP_ID = 443080;

const fetchMocker = createFetchMock(vi);
fetchMocker.enableMocks();

describe("getAppDetails", () => {
  beforeEach(() => {
    fetchMocker.resetMocks();
  });
  afterAll(() => {
    fetchMocker.disableMocks();
  });
  it("should return a SteamAppInfo object for a valid app ID", async () => {
    fetchMocker.mockResponseOnce(JSON.stringify(Response7670));
    const appDetails = await getAppDetails(BIOSHOCK_APP_ID);
    expect(appDetails).toHaveProperty("name", "BioShock™");
    expect(appDetails).toMatchSnapshot();
  });
  it("should handle an invalid app ID", async () => {
    fetchMocker.mockResponse(JSON.stringify(Response443080));
    await expect(getAppDetails(INVALID_APP_ID)).rejects.toThrow(
      SteamStoreError,
    );
    try {
      await getAppDetails(INVALID_APP_ID);
    } catch (error) {
      if (error instanceof SteamStoreError) {
        expect(error.retriable).toBe(false);
      } else {
        throw error;
      }
    }
  });
  it("should handle too many requests", async () => {
    fetchMocker.mockResponse("", { status: 429 });
    await expect(getAppDetails(BIOSHOCK_APP_ID)).rejects.toThrowError(
      SteamStoreError,
    );
    try {
      await getAppDetails(INVALID_APP_ID);
    } catch (error) {
      if (error instanceof SteamStoreError) {
        expect(error.retriable).toBe(true);
      } else {
        throw error;
      }
    }
  });
});

describe("parseReleaseDate", () => {
  it("should return a Date object for a valid steam release date", () => {
    const date = parseReleaseDate("25 Mar, 2013");
    if (!date) {
      throw new Error("Expected a date object");
    }
    expect(date).toBeInstanceOf(Date);
    expect(date.getFullYear()).toBe(2013);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(25);
  });
  it("throws on invalid date", async () => {
    expect(() => parseReleaseDate("invalid date")).toThrow();
  });
  it("handles empty string", () => {
    const date = parseReleaseDate("");
    expect(date).toBe(null);
  });
});
