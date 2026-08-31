// @vitest-environment nuxt
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import type { GameWithProviders } from "#shared/types/Game";
import VirtualGameList from "./VirtualGameList.vue";
import VirtualGameWall from "./VirtualGameWall.vue";

const makeGames = (count: number) =>
  Array.from(
    { length: count },
    (_, index) =>
      ({
        id: index + 1,
        name: `Game ${index + 1}`,
        playtimeMinutes: 0,
        lastPlayedAt: null,
        state: null,
        steamGames: [],
        gogGames: [],
        epicGames: [],
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
