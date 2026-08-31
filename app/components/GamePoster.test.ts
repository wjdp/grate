// @vitest-environment nuxt
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { describe, expect, it } from "vitest";
import type { GameWithProviders } from "#shared/types/Game";
import GamePoster from "./GamePoster.vue";

const makeGame = (overrides: Partial<GameWithProviders> = {}) =>
  ({
    id: 1,
    name: "Portal 2",
    playtimeMinutes: 0,
    state: null,
    steamGames: [],
    gogGames: [],
    epicGames: [],
    ...overrides,
  }) as unknown as GameWithProviders;

describe("GamePoster", () => {
  it("renders the poster image when a poster url exists", async () => {
    const component = await mountSuspended(GamePoster, {
      props: { game: makeGame({ steamGames: [{ appId: 620 }] as never }) },
    });

    const image = component.get("img");
    expect(image.attributes("src")).toBe("/art/steam/620/poster");
    expect(image.attributes("loading")).toBe("lazy");
    expect(
      component.findComponent({ name: "PosterPlaceholder" }).exists(),
    ).toBe(false);
  });

  it("renders the placeholder when no poster url exists", async () => {
    const component = await mountSuspended(GamePoster, {
      props: { game: makeGame() },
    });

    expect(component.find("img").exists()).toBe(false);
    expect(component.text()).toContain("Portal 2");
  });

  it("falls back to the placeholder when the poster fails to load", async () => {
    const component = await mountSuspended(GamePoster, {
      props: { game: makeGame({ steamGames: [{ appId: 620 }] as never }) },
    });

    await component.get("img").trigger("error");

    expect(component.find("img").exists()).toBe(false);
    expect(
      component.findComponent({ name: "PosterPlaceholder" }).exists(),
    ).toBe(true);
  });

  it("retries the image when the game changes", async () => {
    const component = await mountSuspended(GamePoster, {
      props: { game: makeGame({ steamGames: [{ appId: 620 }] as never }) },
    });

    await component.get("img").trigger("error");
    await component.setProps({
      game: makeGame({
        id: 2,
        name: "Half-Life 2",
        steamGames: [{ appId: 220 }] as never,
      }),
    });

    expect(component.get("img").attributes("src")).toBe(
      "/art/steam/220/poster",
    );
  });
});
