// @vitest-environment nuxt
import {
  mockNuxtImport,
  mountSuspended,
  registerEndpoint,
} from "@nuxt/test-utils/runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameWithProviders } from "#shared/types/Game";
import AppSidebarLibraryStates from "./AppSidebarLibraryStates.vue";

const makeGame = (
  id: number,
  overrides: Partial<GameWithProviders> = {},
): GameWithProviders =>
  ({
    id,
    name: `Game ${id}`,
    state: null,
    hidden: false,
    steamGames: [],
    gogGames: [],
    epicGames: [],
    ...overrides,
  }) as unknown as GameWithProviders;

const { routeMock } = vi.hoisted(() => ({
  routeMock: { path: "/games", query: {} as Record<string, string> },
}));
mockNuxtImport("useRoute", () => () => routeMock);

let served: GameWithProviders[] = [];

registerEndpoint("/api/games", () => ({ games: served }));

const cache = () => useNuxtData<{ games: GameWithProviders[] }>("games");

const seed = (games: GameWithProviders[]) => {
  served = games;
  cache().data.value = { games };
};

interface LinkWrapper {
  text(): string;
  attributes(name: string): string | undefined;
}

interface Wrapper {
  findAll(selector: string): LinkWrapper[];
}

const links = (component: Wrapper) => component.findAll("a[data-slot='link']");

const rows = (component: Wrapper) =>
  links(component).map((link) => link.text().trim());

beforeEach(() => {
  routeMock.query = {};
  seed([
    makeGame(1),
    makeGame(2),
    makeGame(3, { state: "PLAYING" }),
    makeGame(4, { state: "COMPLETED" }),
    makeGame(5, { state: "COMPLETED" }),
    makeGame(6, { state: "ABANDONED", hidden: true }),
  ]);
});

// The component fetches the shared library without awaiting it, so the first
// render lands before the data does.
const mount = async () => {
  const component = await mountSuspended(AppSidebarLibraryStates);
  await vi.waitFor(() => expect(rows(component)[0]).not.toBe("All0"));
  return component;
};

describe("AppSidebarLibraryStates", () => {
  it("lists all, unsorted and the states in use with counts", async () => {
    const component = await mount();

    expect(rows(component)).toEqual([
      "All5",
      "Unsorted2",
      "Playing1",
      "Completed2",
    ]);
  });

  it("keeps other query params and drops state for all", async () => {
    routeMock.query = { q: "portal", sort: "name", state: "PLAYING" };

    const component = await mount();
    const hrefs = links(component).map((link) => link.attributes("href"));

    expect(hrefs[0]).toBe("/games?q=portal&sort=name");
    expect(hrefs[1]).toBe("/games?q=portal&sort=name&state=unsorted");
    expect(hrefs[2]).toBe("/games?q=portal&sort=name&state=PLAYING");
  });

  it("marks the selected state active", async () => {
    routeMock.query = { state: "PLAYING" };

    const component = await mount();
    const active = links(component)
      .filter((link) => link.attributes("data-active") !== undefined)
      .map((link) => link.text().trim());

    expect(active).toEqual(["Playing1"]);
  });

  it("gates the accented background on the active link", async () => {
    routeMock.query = { state: "PLAYING" };

    const component = await mount();
    const classes = links(component).map((link) =>
      (link.attributes("class") ?? "").split(/\s+/),
    );
    const inactive = links(component).filter(
      (link) => link.attributes("data-active") === undefined,
    );

    expect(inactive.length).toBeGreaterThan(0);
    for (const list of classes) {
      expect(list).toContain("data-[active]:before:bg-accented");
      expect(list).not.toContain("before:bg-accented");
    }
  });

  it("marks all active when there is no state param", async () => {
    const component = await mount();
    const active = links(component)
      .filter((link) => link.attributes("data-active") !== undefined)
      .map((link) => link.text().trim());

    expect(active).toEqual(["All5"]);
  });

  it("keeps the selected state when nothing is in it", async () => {
    routeMock.query = { state: "RETIRED" };

    const component = await mount();

    expect(rows(component)).toContain("Retired0");
  });

  it("adds a state as soon as the shared cache is patched", async () => {
    const component = await mount();
    expect(rows(component)).not.toContain("Backlog1");

    const cached = cache().data;
    cached.value = {
      games: (cached.value?.games ?? []).map((game) =>
        game.id === 1 ? { ...game, state: "BACKLOG" as const } : game,
      ),
    };
    await nextTick();

    expect(rows(component)).toContain("Backlog1");
    expect(rows(component)).toContain("Unsorted1");
  });
});
