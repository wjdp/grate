// @vitest-environment nuxt
import {
  mockNuxtImport,
  mountSuspended,
  registerEndpoint,
} from "@nuxt/test-utils/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppCommandPalette from "./AppCommandPalette.vue";

const games = [
  {
    id: 1,
    name: "Portal 2",
    state: "PLAYING",
    steamGames: [{ appId: 620, playtimeForever: 10 }],
    gogGames: [],
    epicGames: [],
  },
  {
    id: 2,
    name: "Baldur's Gate",
    state: null,
    steamGames: [],
    gogGames: [],
    epicGames: [],
  },
];

registerEndpoint("/api/games", () => ({ games }));

const { routeMock } = vi.hoisted(() => ({
  routeMock: { path: "/games", params: {} as Record<string, string> },
}));
mockNuxtImport("useRoute", () => () => routeMock);

// Reka's listbox settles its filtering over several microtask/timer hops.
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

const mounted: { unmount: () => void }[] = [];

const mountPalette = async () => {
  const component = await mountSuspended(AppCommandPalette, {
    attachTo: document.body,
  });
  mounted.push(component);
  useCommandPalette().open();
  await settle();
  return component;
};

const itemLabels = () =>
  Array.from(document.querySelectorAll("[role='option']")).map((option) =>
    option.textContent?.trim(),
  );

const groupLabels = () =>
  // Scoped to direct children: state badges inside items carry a label slot too.
  Array.from(
    document.querySelectorAll("[data-slot='group'] > [data-slot='label']"),
  ).map((label) => label.textContent?.trim());

const search = async (term: string) => {
  const input = document.querySelector("input")!;
  input.value = term;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
};

beforeEach(() => {
  routeMock.path = "/games";
  routeMock.params = {};
  localStorage.clear();
  clearNuxtState(
    [
      "commandPaletteOpen",
      "commandPalettePanes",
      "recentlyViewedGames",
      "recentlyViewedGamesLoaded",
    ],
    { reset: false },
  );
});

afterEach(() => {
  // The modal teleports into the body; a leftover palette leaks into the next test.
  while (mounted.length) mounted.pop()!.unmount();
  document.body.innerHTML = "";
});

describe("AppCommandPalette", () => {
  it("shows the navigation pages when opened with an empty query", async () => {
    await mountPalette();

    expect(groupLabels()).toEqual(["Navigation"]);
    expect(itemLabels()).toEqual(
      expect.arrayContaining(["Library", "Duplicates", "Tasks", "Steam art"]),
    );
  });

  it("lists recently viewed games above navigation", async () => {
    useRecentlyViewedGames().recordView(2);
    await mountPalette();

    expect(groupLabels()).toEqual(["Recently viewed", "Navigation"]);
    expect(itemLabels()[0]).toContain("Baldur's Gate");
  });

  it("searches the library by name", async () => {
    await mountPalette();
    await search("portal");

    expect(groupLabels()).toEqual(["Games"]);
    expect(itemLabels()[0]).toContain("Portal 2");
  });
});
