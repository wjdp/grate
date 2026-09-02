// steam-user ships no type declarations; this covers only the anonymous
// appinfo flow server/providers/steam/pics.ts uses.
declare module "steam-user" {
  interface ProductInfoResult {
    apps: Record<
      string,
      {
        changenumber?: number;
        missingToken?: boolean;
        appinfo?: { common?: Record<string, unknown> };
      }
    >;
    unknownApps: number[];
  }

  class SteamUser {
    on(event: "loggedOn", listener: () => void): this;
    on(event: "error", listener: (error: Error) => void): this;
    logOn(details: { anonymous: true }): void;
    logOff(): void;
    getProductInfo(
      apps: number[],
      packages: number[],
      inclTokens?: boolean,
    ): Promise<ProductInfoResult>;
  }

  export = SteamUser;
}
