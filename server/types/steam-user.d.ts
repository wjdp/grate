// steam-user ships no types. Only the surface lib/steam/pics.ts uses is
// declared; extend as more of the client is needed.
declare module "steam-user" {
  interface PicsApp {
    changenumber?: number;
    appinfo?: { common?: unknown };
  }

  interface PicsProductInfo {
    apps?: Record<string, PicsApp | undefined>;
  }

  export default class SteamUser {
    on(event: "loggedOn", listener: () => void): this;
    on(event: "error", listener: (error: Error) => void): this;
    logOn(details: { anonymous: true }): void;
    logOff(): void;
    getProductInfo(
      apps: number[],
      packages: number[],
      inclTokens?: boolean,
    ): Promise<PicsProductInfo>;
  }
}
