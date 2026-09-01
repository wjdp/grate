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
    hidden: false,
    steamGames: [{ appId: 620, playtimeForever: 10 }],
    gogGames: [],
    epicGames: [],
  },
  {
    id: 2,
    name: "Baldur's Gate",
    state: null,
    hidden: false,
    steamGames: [],
    gogGames: [],
    epicGames: [],
  },
  {
    id: 3,
    name: "Portal Benchmark",
    state: null,
    hidden: true,
    steamGames: [],
    gogGames: [],
    epicGames: [],
  },
];

registerEndpoint("/api/games", () => ({ games }));

const stateRequests: unknown[] = [];
registerEndpoint("/api/games/1/state", {
  method: "PATCH",
  handler: async (event) => {
    // The mock request carries the raw JSON body on the node request object.
    const { body } = event.node.req as unknown as { body: string };
    stateRequests.push(JSON.parse(body));
    return { game: { id: 1 } };
  },
});

const { routeMock } = vi.hoisted(() => ({
  routeMock: { path: "/games", params: {} as Record<string, string> },
}));
mockNuxtImport("useRoute", () => () => routeMock);

const mounted: { unmount: () => void }[] = [];

const itemLabels = () =>
  Array.from(document.querySelectorAll("[role='option']")).map((option) =>
    option.textContent?.trim(),
  );

// Reka's listbox settles its filtering over several microtask/timer hops.
const awaitItems = (predicate: (labels: (string | undefined)[]) => boolean) =>
  vi.waitFor(() => expect(predicate(itemLabels())).toBe(true));

const mountPalette = async () => {
  const component = await mountSuspended(AppCommandPalette, {
    attachTo: document.body,
  });
  mounted.push(component);
  useCommandPalette().open();
  await awaitItems((labels) => labels.length > 0);
  return component;
};

const groupLabels = () =>
  // Scoped to direct children: state badges inside items carry a label slot too.
  Array.from(
    document.querySelectorAll("[data-slot='group'] > [data-slot='label']"),
  ).map((label) => label.textContent?.trim());

const search = async (term: string) => {
  const input = document.querySelector("input")!;
  input.value = term;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await awaitItems(
    (labels) =>
      labels.length > 0 &&
      labels.every((label) =>
        label?.toLowerCase().includes(term.toLowerCase()),
      ),
  );
};

const pick = async (label: string) => {
  const option = Array.from(document.querySelectorAll("[role='option']")).find(
    (item) => item.textContent?.includes(label),
  )! as HTMLElement;
  option.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  option.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  option.click();
};

beforeEach(() => {
  stateRequests.length = 0;
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

  it("shows actions for the game being viewed", async () => {
    routeMock.path = "/game/1";
    routeMock.params = { id: "1" };
    await mountPalette();

    expect(groupLabels()[0]).toBe("Portal 2");
    expect(itemLabels().slice(0, 5)).toEqual([
      "Go to game",
      "Set state…",
      "Hide",
      "Play",
      "Open store page",
    ]);
  });

  it("offers Unhide on a hidden game's own page", async () => {
    routeMock.path = "/game/3";
    routeMock.params = { id: "3" };
    await mountPalette();

    expect(groupLabels()[0]).toBe("Portal Benchmark");
    expect(itemLabels().slice(0, 3)).toEqual([
      "Go to game",
      "Set state…",
      "Unhide",
    ]);
  });

  it("shows the state list on the set-state pane", async () => {
    const { pushPane } = useCommandPalette();
    await mountPalette();
    pushPane({ kind: "set-state", gameId: 1 });
    await awaitItems((labels) => labels.includes("Ignored"));

    expect(itemLabels()).toEqual([
      "Unsorted",
      "Backlog",
      "Shelved",
      "Playing",
      "Stalled",
      "Periodic",
      "Played",
      "Completed",
      "Retired",
      "Abandoned",
      "Ignored",
    ]);
  });

  it("searches the library by name", async () => {
    await mountPalette();
    await search("portal");

    expect(groupLabels()).toEqual(["Games"]);
    expect(itemLabels()[0]).toContain("Portal 2");
  });

  it("leaves hidden games out of the search results", async () => {
    await mountPalette();
    await search("portal");

    expect(itemLabels()).toHaveLength(1);
    expect(itemLabels()[0]).not.toContain("Benchmark");
  });

  it("sets the state and closes on picking one", async () => {
    const palette = useCommandPalette();
    await mountPalette();
    palette.pushPane({ kind: "set-state", gameId: 1 });
    await awaitItems((labels) => labels.includes("Completed"));
    await pick("Completed");
    await vi.waitFor(() => expect(palette.isOpen.value).toBe(false));

    expect(stateRequests).toEqual([{ state: "COMPLETED" }]);
  });
});
