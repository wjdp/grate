// @vitest-environment nuxt
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { describe, expect, it } from "vitest";
import type { GameWithProviders } from "#shared/types/Game";
import LibraryFilterSummary from "./LibraryFilterSummary.vue";

const makeGame = (playtimeMinutes: number) =>
  ({
    id: playtimeMinutes,
    name: `Game ${playtimeMinutes}`,
    playtimeMinutes,
    state: null,
    hidden: false,
    steamGames: [],
    gogGames: [],
    epicGames: [],
  }) as unknown as GameWithProviders;

const mount = (games: GameWithProviders[]) =>
  mountSuspended(LibraryFilterSummary, { props: { games } });

describe("LibraryFilterSummary", () => {
  it("summarises counts and total playtime", async () => {
    const component = await mount([makeGame(1500), makeGame(90), makeGame(0)]);

    const text = component.text().replace(/\s+/g, " ");
    expect(text).toContain("3 games");
    expect(text).toContain("1d 2h 30m total");
    expect(text).toContain("2 played");
    expect(text).toContain("1 unplayed");
  });

  it("uses the singular for one game", async () => {
    const component = await mount([makeGame(60)]);

    const text = component.text().replace(/\s+/g, " ");
    expect(text).toContain("1 game");
    expect(text).not.toContain("1 games");
  });

  it("shows zero playtime for an empty result set", async () => {
    const component = await mount([]);

    const text = component.text().replace(/\s+/g, " ");
    expect(text).toContain("0 games");
    expect(text).toContain("0m total");
    expect(text).toContain("0 played");
    expect(text).toContain("0 unplayed");
  });
});
