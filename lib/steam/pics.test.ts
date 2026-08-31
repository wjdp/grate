import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPicsMetadata } from "~~/lib/steam/pics";
import { SteamServiceError } from "~~/lib/steam/service";

import Common2950790 from "~~/lib/steam/fixtures/pics/2950790.json";

const steamUser = vi.hoisted(() => {
  const session: {
    productInfo: unknown;
    logOnError: Error | null;
    productInfoError: Error | null;
    logOffCount: number;
  } = {
    productInfo: { apps: {}, unknownApps: [] },
    logOnError: null,
    productInfoError: null,
    logOffCount: 0,
  };

  class FakeSteamUser {
    private listeners: Record<string, (argument?: unknown) => void> = {};

    on(event: string, listener: (argument?: unknown) => void) {
      this.listeners[event] = listener;
      return this;
    }

    logOn() {
      setTimeout(() => {
        if (session.logOnError) {
          this.listeners.error?.(session.logOnError);
        } else {
          this.listeners.loggedOn?.();
        }
      }, 0);
    }

    logOff() {
      session.logOffCount += 1;
    }

    getProductInfo() {
      return session.productInfoError
        ? Promise.reject(session.productInfoError)
        : Promise.resolve(session.productInfo);
    }
  }

  return { session, FakeSteamUser };
});

vi.mock("steam-user", () => ({ default: steamUser.FakeSteamUser }));

const IRON_NEST_APP_ID = 2950790;
const OLD_APP_ID = 220;
const BARE_APP_ID = 480;

// The paths an older app publishes: a legacy-relative capsule and a bare logo
// filename. Both are opaque and must survive verbatim.
const oldAppCommon = {
  icon: "fcfb366051782b8ebf2aa297f3b746395858cb62",
  library_assets_full: {
    library_capsule: {
      image: {
        english: "ac2f074d790656a06ef8305bd54a6f64e9a70082/library_600x900.jpg",
      },
    },
    library_logo: {
      image: { english: "logo.png" },
    },
  },
  review_score: "9",
  review_percentage: "97",
};

const bareAppCommon = {
  name: "Spacewar",
  type: "game",
};

function respondWith(apps: Record<string, unknown>) {
  steamUser.session.productInfo = { apps, unknownApps: [] };
}

describe("getPicsMetadata", () => {
  beforeEach(() => {
    steamUser.session.logOnError = null;
    steamUser.session.productInfoError = null;
    steamUser.session.logOffCount = 0;
    respondWith({});
  });

  it("maps a modern app's library assets and metadata", async () => {
    respondWith({
      [IRON_NEST_APP_ID]: {
        changenumber: 28123456,
        appinfo: { common: Common2950790 },
      },
    });

    const metadata = await getPicsMetadata([IRON_NEST_APP_ID]);
    const app = metadata.get(IRON_NEST_APP_ID);

    expect(app).toMatchObject({
      changenumber: 28123456,
      capsulePath:
        "91a172cd9ff7cc855eb8dd21bdcf41a39c0e4d75/library_capsule.jpg",
      capsule2xPath:
        "91a172cd9ff7cc855eb8dd21bdcf41a39c0e4d75/library_capsule_2x.jpg",
      heroPath: "a45a48813a7358632159a1386224f12694690353/library_hero.jpg",
      hero2xPath:
        "a45a48813a7358632159a1386224f12694690353/library_hero_2x.jpg",
      heroBlurPath:
        "a45a48813a7358632159a1386224f12694690353/library_hero_blur.jpg",
      logoPath: "5a2c21dd589042a48c92f01a9d8bdeddce9def94/logo.png",
      logo2xPath: "5a2c21dd589042a48c92f01a9d8bdeddce9def94/logo_2x.png",
      headerPath: "7c66df1de4cb7f5c34cd2f779d21072b50370fa7/library_header.jpg",
      header2xPath:
        "7c66df1de4cb7f5c34cd2f779d21072b50370fa7/library_header_2x.jpg",
      iconHash: "9e5fd22a0678b6d1b82850f2f95a83f82f2a1c96",
      reviewScore: 9,
      reviewPercentage: 97,
      deckCompatibility: 3,
      steamosCompatibility: 2,
      steamMachineCompatibility: 3,
      osList: "windows",
      controllerSupport: "full",
    });
    expect(app?.logoPosition).toEqual({
      pinnedPosition: "CenterCenter",
      widthPct: 43.36437718277068,
      heightPct: 74.31726430776536,
    });
    expect(app?.steamReleaseDate).toEqual(new Date(1786028312 * 1000));
    expect(app?.originalReleaseDate).toBeNull();
    expect(app?.nameLocalized).toMatchObject({ schinese: "铁巢重炮" });
    expect(app?.supportedLanguages).toHaveProperty("english");
  });

  it("preserves store tag and association order", async () => {
    respondWith({
      [IRON_NEST_APP_ID]: { appinfo: { common: Common2950790 } },
    });

    const app = (await getPicsMetadata([IRON_NEST_APP_ID])).get(
      IRON_NEST_APP_ID,
    );

    expect(app?.storeTags?.slice(0, 3)).toEqual([4168, 599, 4175]);
    expect(app?.associations?.slice(0, 2)).toEqual([
      { type: "developer", name: "Nick Nieuwoudt" },
      { type: "developer", name: "Dominik Latos" },
    ]);
  });

  it("stores an older app's legacy paths verbatim", async () => {
    respondWith({ [OLD_APP_ID]: { appinfo: { common: oldAppCommon } } });

    const app = (await getPicsMetadata([OLD_APP_ID])).get(OLD_APP_ID);

    expect(app).toMatchObject({
      capsulePath:
        "ac2f074d790656a06ef8305bd54a6f64e9a70082/library_600x900.jpg",
      capsule2xPath: null,
      logoPath: "logo.png",
      logo2xPath: null,
      heroPath: null,
      heroBlurPath: null,
      headerPath: null,
      reviewScore: 9,
    });
    expect(app?.logoPosition).toBeNull();
  });

  it("returns nulls for an app with no assets or review fields", async () => {
    respondWith({ [BARE_APP_ID]: { appinfo: { common: bareAppCommon } } });

    const app = (await getPicsMetadata([BARE_APP_ID])).get(BARE_APP_ID);

    expect(app).toEqual({
      changenumber: null,
      capsulePath: null,
      capsule2xPath: null,
      heroPath: null,
      hero2xPath: null,
      heroBlurPath: null,
      logoPath: null,
      logo2xPath: null,
      headerPath: null,
      header2xPath: null,
      logoPosition: null,
      iconHash: null,
      reviewScore: null,
      reviewPercentage: null,
      deckCompatibility: null,
      steamosCompatibility: null,
      steamMachineCompatibility: null,
      storeTags: null,
      associations: null,
      steamReleaseDate: null,
      originalReleaseDate: null,
      nameLocalized: null,
      supportedLanguages: null,
      osList: null,
      controllerSupport: null,
    });
  });

  it("omits an app missing from the response", async () => {
    respondWith({ [OLD_APP_ID]: { appinfo: { common: oldAppCommon } } });

    const metadata = await getPicsMetadata([OLD_APP_ID, BARE_APP_ID]);

    expect(metadata.has(OLD_APP_ID)).toBe(true);
    expect(metadata.has(BARE_APP_ID)).toBe(false);
    expect(metadata.size).toBe(1);
  });

  it("logs off once the batch is mapped", async () => {
    respondWith({ [OLD_APP_ID]: { appinfo: { common: oldAppCommon } } });

    await getPicsMetadata([OLD_APP_ID]);

    expect(steamUser.session.logOffCount).toBe(1);
  });

  it("skips the session entirely for an empty batch", async () => {
    const metadata = await getPicsMetadata([]);

    expect(metadata.size).toBe(0);
    expect(steamUser.session.logOffCount).toBe(0);
  });

  it("rejects when the client emits an error", async () => {
    steamUser.session.logOnError = new Error("connection lost");

    await expect(getPicsMetadata([OLD_APP_ID])).rejects.toThrow(
      SteamServiceError,
    );
  });

  it("rejects when the appinfo request fails", async () => {
    steamUser.session.productInfoError = new Error("request failed");

    await expect(getPicsMetadata([OLD_APP_ID])).rejects.toThrow(
      SteamServiceError,
    );
  });

  it("rejects when the session never completes", async () => {
    vi.useFakeTimers();
    try {
      steamUser.session.productInfo = new Promise(() => {}) as never;
      const pending = getPicsMetadata([OLD_APP_ID]);
      const assertion = expect(pending).rejects.toThrow(SteamServiceError);
      await vi.advanceTimersByTimeAsync(60_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
