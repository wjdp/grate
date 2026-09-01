import { describe, expect, it } from "vitest";
import type { GameWithProviders } from "#shared/types/Game";
import {
  buildGameActionCommands,
  buildNavigationCommands,
  GAME_STATE_COMMAND_GROUPS,
  GAME_STATE_COMMANDS,
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
      "Settings",
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

describe("buildGameActionCommands", () => {
  it("offers only navigation and state for a game with no launch target", () => {
    const commands = buildGameActionCommands(makeGame({}));

    expect(commands.map((command) => command.id)).toEqual([
      "go-to",
      "set-state",
    ]);
  });

  it("offers play and store links from the primary provider", () => {
    const commands = buildGameActionCommands(
      makeGame({
        steamGames: [
          { appId: 620, playtimeForever: 10 },
        ] as unknown as GameWithProviders["steamGames"],
      }),
    );

    expect(commands.map((command) => command.id)).toEqual([
      "go-to",
      "set-state",
      "play",
      "open-store",
    ]);
    expect(commands.find((command) => command.id === "play")?.url).toBe(
      "steam://run/620",
    );
  });

  it("picks the provider with the most playtime", () => {
    const commands = buildGameActionCommands(
      makeGame({
        steamGames: [
          { appId: 620, playtimeForever: 10 },
        ] as unknown as GameWithProviders["steamGames"],
        gogGames: [
          { gogId: 42, playtimeMinutes: 500 },
        ] as unknown as GameWithProviders["gogGames"],
      }),
    );

    expect(commands.find((command) => command.id === "play")?.url).toBe(
      "goggalaxy://runGame/42",
    );
  });
});

describe("game state commands", () => {
  it("groups the states as GameStateControl does", () => {
    const groups = GAME_STATE_COMMAND_GROUPS.map((group) =>
      group.map((command) => command.label),
    );

    expect(groups).toEqual([
      ["Unsorted"],
      ["Backlog"],
      ["Playing", "Periodic", "Shelved"],
      ["Played", "Completed", "Retired", "Abandoned"],
      ["Ignored"],
    ]);
  });

  it("offers unsorted plus every state, hue-tinted", () => {
    expect(GAME_STATE_COMMANDS).toHaveLength(10);
    expect(GAME_STATE_COMMANDS[0]).toMatchObject({
      state: null,
      icon: "i-lucide-circle-dashed",
    });
    expect(
      GAME_STATE_COMMANDS.find((command) => command.state === "COMPLETED"),
    ).toMatchObject({
      icon: "i-lucide-trophy",
      iconClass: "text-green-600 dark:text-green-400",
    });
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
