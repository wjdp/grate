import { describe, expect, it } from "vitest";
import { GAME_STATES } from "#shared/game-state";
import {
  gameStateItem,
  gameStateItemGroups,
  unsortedGameStateItem,
} from "./gameStateItems";

describe("gameStateItemGroups", () => {
  it("groups unsorted and the states for the menu", () => {
    const labels = gameStateItemGroups.map((group) =>
      group.map((item) => item.label),
    );

    expect(labels).toEqual([
      ["Unsorted"],
      ["Backlog", "Shelved"],
      ["Playing", "Stalled", "Periodic"],
      ["Played", "Completed", "Retired", "Abandoned"],
      ["Ignored"],
    ]);
  });

  it("includes every game state exactly once", () => {
    const values = gameStateItemGroups.flat().map((item) => item.value);

    expect(values.filter((value) => value !== null).sort()).toEqual(
      [...GAME_STATES].sort(),
    );
    expect(values.filter((value) => value === null)).toHaveLength(1);
  });

  it("starts with the unsorted item", () => {
    expect(gameStateItemGroups[0]?.[0]).toBe(unsortedGameStateItem);
  });
});

describe("gameStateItem", () => {
  it("carries the label, icon and hue of a state", () => {
    expect(gameStateItem("PLAYING")).toEqual({
      value: "PLAYING",
      label: "Playing",
      icon: "i-lucide-play",
      iconClass: "text-blue-600 dark:text-blue-400",
    });
  });
});
