// @vitest-environment nuxt
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import type { GameWithProviders } from "#shared/types/Game";
import {
  forgetScrollOffsets,
  rememberScrollOffset,
} from "../composables/useScrollMemory";
import VirtualGameList from "./VirtualGameList.vue";
import VirtualGameWall from "./VirtualGameWall.vue";

const makeGames = (count: number, overrides: Partial<GameWithProviders> = {}) =>
  Array.from(
    { length: count },
    (_, index) =>
      ({
        id: index + 1,
        name: `Game ${index + 1}`,
        playtimeMinutes: 0,
        lastPlayedAt: null,
        state: null,
        hidden: false,
        steamGames: [],
        gogGames: [],
        epicGames: [],
        ...overrides,
      }) as unknown as GameWithProviders,
  );

const ROW_HEIGHT = 48;
const VIEWPORT_HEIGHT = 800;

// happy-dom lays nothing out, so the virtualiser sees a zero-height viewport
// and renders nothing at all unless we hand it plausible measurements.
const stubLayout = () => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => VIEWPORT_HEIGHT,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: () => 1200,
  });
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1200,
      bottom: ROW_HEIGHT,
      width: 1200,
      height: ROW_HEIGHT,
      toJSON: () => ({}),
    }) as DOMRect;
};

describe("virtualised game views", () => {
  beforeEach(stubLayout);

  it("renders only a window of rows rather than every game", async () => {
    const component = await mountSuspended(VirtualGameList, {
      props: { games: makeGames(800) },
    });
    await nextTick();

    const rows = component.findAllComponents({ name: "GameRow" });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(200);
  });

  it("sizes the list to the full game count so the scrollbar is honest", async () => {
    const component = await mountSuspended(VirtualGameList, {
      props: { games: makeGames(800) },
    });
    await nextTick();

    const spacer = component.get("[style*='height']");
    expect(spacer.attributes("style")).toMatch(/height: \d{4,}px/);
  });

  it("renders a windowed set of posters in the wall view", async () => {
    const component = await mountSuspended(VirtualGameWall, {
      props: { games: makeGames(800) },
    });
    await nextTick();

    const posters = component.findAllComponents({ name: "GamePoster" });
    expect(posters.length).toBeGreaterThan(0);
    expect(posters.length).toBeLessThan(200);
  });
});

describe("hidden game marker", () => {
  beforeEach(stubLayout);

  it("marks hidden games in the list view", async () => {
    const component = await mountSuspended(VirtualGameList, {
      props: { games: makeGames(4, { hidden: true }) },
    });
    await nextTick();

    expect(component.html()).toContain("i-lucide:eye-off");
  });

  it("leaves visible games unmarked in the list view", async () => {
    const component = await mountSuspended(VirtualGameList, {
      props: { games: makeGames(4) },
    });
    await nextTick();

    expect(component.html()).not.toContain("i-lucide:eye-off");
  });

  it("marks hidden games in the wall view", async () => {
    const component = await mountSuspended(VirtualGameWall, {
      props: { games: makeGames(4, { hidden: true }) },
    });
    await nextTick();

    expect(component.html()).toContain("i-lucide:eye-off");
  });

  it("leaves visible games unmarked in the wall view", async () => {
    const component = await mountSuspended(VirtualGameWall, {
      props: { games: makeGames(4) },
    });
    await nextTick();

    expect(component.html()).not.toContain("i-lucide:eye-off");
  });
});

describe("scroll memory", () => {
  beforeEach(() => {
    stubLayout();
    forgetScrollOffsets();
  });

  const scrollParent = () => document.scrollingElement as HTMLElement;

  it("restores the offset saved for the current route on mount", async () => {
    rememberScrollOffset(useRoute().fullPath, 1234);

    await mountSuspended(VirtualGameList, { props: { games: makeGames(800) } });
    await nextTick();
    await nextTick();

    expect(scrollParent().scrollTop).toBe(1234);
  });

  it("restores the offset in the wall view too", async () => {
    rememberScrollOffset(useRoute().fullPath, 987);

    await mountSuspended(VirtualGameWall, { props: { games: makeGames(800) } });
    await nextTick();
    await nextTick();

    expect(scrollParent().scrollTop).toBe(987);
  });

  it("records the scroll element's offset so a later mount lands there", async () => {
    const first = await mountSuspended(VirtualGameList, {
      props: { games: makeGames(800) },
    });
    await nextTick();

    scrollParent().scrollTop = 555;
    scrollParent().dispatchEvent(new Event("scroll"));
    first.unmount();
    scrollParent().scrollTop = 0;

    await mountSuspended(VirtualGameList, { props: { games: makeGames(800) } });
    await nextTick();
    await nextTick();

    expect(scrollParent().scrollTop).toBe(555);
  });

  it("leaves the offset alone when nothing is saved for the route", async () => {
    scrollParent().scrollTop = 0;

    await mountSuspended(VirtualGameList, { props: { games: makeGames(800) } });
    await nextTick();
    await nextTick();

    expect(scrollParent().scrollTop).toBe(0);
  });

  it("does not re-restore when the games prop changes", async () => {
    rememberScrollOffset(useRoute().fullPath, 400);

    const component = await mountSuspended(VirtualGameList, {
      props: { games: makeGames(800) },
    });
    await nextTick();
    await nextTick();

    scrollParent().scrollTop = 0;
    await component.setProps({ games: makeGames(600) });
    await nextTick();
    await nextTick();

    expect(scrollParent().scrollTop).toBe(0);
  });
});

describe("scroll memory eviction", () => {
  beforeEach(() => {
    stubLayout();
    forgetScrollOffsets();
  });

  it("drops the least recently saved routes beyond the cap", async () => {
    const route = useRoute().fullPath;
    rememberScrollOffset(route, 1234);
    for (let index = 0; index < 60; index++) {
      rememberScrollOffset(`/games?page=${index}`, index);
    }

    const scrollParent = document.scrollingElement as HTMLElement;
    scrollParent.scrollTop = 0;
    await mountSuspended(VirtualGameList, { props: { games: makeGames(800) } });
    await nextTick();
    await nextTick();

    expect(scrollParent.scrollTop).toBe(0);
  });
});
