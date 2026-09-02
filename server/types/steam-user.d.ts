// steam-user ships no types; only the anonymous PICS surface used by server/providers/steam/pics.ts is declared.
declare module "steam-user" {
  interface ProductInfoResult {
    apps?: Record<
      string,
      | {
          changenumber?: number;
          appinfo?: { common?: unknown };
        }
      | undefined
    >;
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
