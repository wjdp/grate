import type { GameWithProviders } from "#shared/types/Game";
import { describe, expect, it } from "vitest";
import {
  buildNavigationCommands,
  getGameIconUrl,
  resolveRecentGames,
} from "./commandPalette";

const makeGame = (game: Partial<GameWithProviders>): GameWithProviders =>
  ({
    id: 1,
    name: "Test Game",
    state: null,
    steamGames: [],
    gogGames: [],
    epicGames: [],
    ...game,
  }) as unknown as GameWithProviders;

describe("buildNavigationCommands", () => {
  it("lists the sidebar pages then the debug pages", () => {
    const labels = buildNavigationCommands(null).map(
      (command) => command.label,
    );

    expect(labels).toEqual([
      "Library",
      "Organise",
      "Duplicates",
      "Activity",
      "Providers",
      "Tasks",
      "Components",
      "Events",
      "Steam art",
    ]);
  });

  it("badges duplicates with the count when there are any", () => {
    const duplicates = buildNavigationCommands(3).find(
      (command) => command.to === "/duplicates",
    );

    expect(duplicates?.suffix).toBe("3");
  });

  it("omits the duplicates badge when the count is zero or unknown", () => {
    for (const count of [0, null]) {
      const duplicates = buildNavigationCommands(count).find(
        (command) => command.to === "/duplicates",
      );

      expect(duplicates?.suffix).toBeUndefined();
    }
  });
});

describe("resolveRecentGames", () => {
  const games = [
    makeGame({ id: 1, name: "One" }),
    makeGame({ id: 2, name: "Two" }),
    makeGame({ id: 3, name: "Three" }),
  ];

  it("keeps the recency order rather than the library order", () => {
    const resolved = resolveRecentGames(games, [3, 1]);

    expect(resolved.map((game) => game.name)).toEqual(["Three", "One"]);
  });

  it("skips ids that are no longer in the library", () => {
    const resolved = resolveRecentGames(games, [99, 2]);

    expect(resolved.map((game) => game.id)).toEqual([2]);
  });

  it("resolves to nothing when the library has not loaded", () => {
    expect(resolveRecentGames([], [1, 2])).toEqual([]);
  });
});

describe("getGameIconUrl", () => {
  it("returns the art route for a game with provider art", () => {
    const url = getGameIconUrl(
      makeGame({
        steamGames: [
          { appId: 620 },
        ] as unknown as GameWithProviders["steamGames"],
      }),
    );

    expect(url).toBe("/art/steam/620/icon");
  });

  it("returns null when no provider offers art", () => {
    expect(getGameIconUrl(makeGame({}))).toBeNull();
  });
});
