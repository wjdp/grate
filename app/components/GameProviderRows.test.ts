// @vitest-environment nuxt
import {
  mockNuxtImport,
  mountSuspended,
  registerEndpoint,
} from "@nuxt/test-utils/runtime";
import UApp from "@nuxt/ui/components/App.vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import type { GameDetail } from "#shared/types/Game";
import GameProviderRows from "./GameProviderRows.vue";

const { navigateToMock } = vi.hoisted(() => ({ navigateToMock: vi.fn() }));
mockNuxtImport("navigateTo", () => navigateToMock);

const splitRequests: unknown[] = [];
let splitFails = false;

registerEndpoint("/api/games/split", {
  method: "POST",
  handler: async (event) => {
    // The mock request carries the raw JSON body on the node request object.
    const { body } = event.node.req as unknown as { body: string };
    splitRequests.push(JSON.parse(body));
    if (splitFails) throw new Error("split failed");
    return { game: { id: 42 } };
  },
});

const makeGame = (rows: Partial<GameDetail>): GameDetail =>
  ({
    id: 1,
    name: "Test Game",
    steamGames: [],
    gogGames: [],
    epicGames: [],
    ...rows,
  }) as unknown as GameDetail;

const steamRow = {
  appId: 620,
  name: "Portal 2",
  playtimeForever: 125,
  rTimeLastPlayed: 1_600_000_000,
};

const gogRow = {
  gogId: 1207658930,
  name: "Baldur's Gate",
  playtimeMinutes: 60,
  lastPlayedAt: "2021-03-04T00:00:00.000Z",
};

const epicRow = {
  epicId: 7,
  name: "Alan Wake",
  playtimeMinutes: null,
  lastPlayedAt: null,
  namespace: "ns",
  catalogItemId: "cat",
  appName: "app",
  storeSlug: "alan-wake",
};

// UTooltip needs the TooltipProvider that UApp installs.
const mount = (game: GameDetail) =>
  mountSuspended(
    defineComponent({
      setup: () => () =>
        h(UApp, null, {
          default: () => h(GameProviderRows, { game }),
        }),
    }),
  );

beforeEach(() => {
  splitRequests.length = 0;
  splitFails = false;
  navigateToMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GameProviderRows", () => {
  it("renders a card per provider row, steam then gog then epic", async () => {
    const component = await mount(
      makeGame({
        steamGames: [steamRow],
        gogGames: [gogRow],
        epicGames: [epicRow],
      } as unknown as Partial<GameDetail>),
    );

    const cards = component.findAll("h2 ~ div > div");
    expect(cards).toHaveLength(3);
    expect(component.text()).toContain("Steam");
    expect(component.text()).toContain("#620");
    expect(component.text()).toContain("Portal 2");
    expect(component.text()).toContain("GOG");
    expect(component.text()).toContain("Epic Games");
    expect(component.text().indexOf("Portal 2")).toBeLessThan(
      component.text().indexOf("Alan Wake"),
    );
  });

  it("formats playtime and last played, falling back for empty values", async () => {
    const component = await mount(
      makeGame({
        steamGames: [steamRow],
        epicGames: [epicRow],
      } as unknown as Partial<GameDetail>),
    );

    const text = component.text();
    expect(text).toContain("2h 5m");
    expect(text).toContain("13 September 2020");
    expect(text).toContain("None");
    expect(text).toContain("Never");
  });

  it("links play and open to provider protocol urls", async () => {
    const component = await mount(
      makeGame({ steamGames: [steamRow] } as unknown as Partial<GameDetail>),
    );

    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const buttonLabelled = (label: string) =>
      component
        .findAll("button")
        .find(
          (button) =>
            button.text().includes(label) ||
            button.attributes("aria-label") === label,
        )!;

    await buttonLabelled("Play").trigger("click");
    expect(openSpy).toHaveBeenCalledWith("steam://run/620", "_self");

    await buttonLabelled("Open in Steam").trigger("click");
    expect(openSpy).toHaveBeenCalledWith(
      "steam://nav/games/details/620",
      "_self",
    );
  });

  it("hides the split control when there is only one provider row", async () => {
    const component = await mount(
      makeGame({ steamGames: [steamRow] } as unknown as Partial<GameDetail>),
    );

    expect(
      component
        .findAll("button")
        .filter((button) => button.attributes("aria-label") === "Split off"),
    ).toHaveLength(0);
  });

  it("splits a row and navigates to the new game", async () => {
    const component = await mount(
      makeGame({
        steamGames: [steamRow],
        gogGames: [gogRow],
      } as unknown as Partial<GameDetail>),
    );

    const splitButtons = component
      .findAll("button")
      .filter((button) => button.attributes("aria-label") === "Split off");
    expect(splitButtons).toHaveLength(2);

    await splitButtons[1]!.trigger("click");
    await vi.waitFor(() => expect(navigateToMock).toHaveBeenCalled());

    expect(splitRequests).toEqual([
      { provider: "gog", providerId: gogRow.gogId },
    ]);
    expect(navigateToMock).toHaveBeenCalledWith("/game/42");
  });

  it("shows an alert when the split fails", async () => {
    splitFails = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const component = await mount(
      makeGame({
        steamGames: [steamRow],
        gogGames: [gogRow],
      } as unknown as Partial<GameDetail>),
    );

    const splitButton = component
      .findAll("button")
      .find((button) => button.attributes("aria-label") === "Split off")!;
    await splitButton.trigger("click");
    await vi.waitFor(() =>
      expect(component.text()).toContain("Could not split this provider row."),
    );

    expect(navigateToMock).not.toHaveBeenCalled();
  });
});
