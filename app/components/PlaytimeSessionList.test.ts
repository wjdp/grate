// @vitest-environment nuxt
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UApp from "@nuxt/ui/components/App.vue";
import { describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import type { PlaytimeSessionJson } from "#shared/types/PlaytimeSession";
import PlaytimeSessionList from "./PlaytimeSessionList.vue";

// UTooltip needs the TooltipProvider that UApp installs.
const mount = (sessions: PlaytimeSessionJson[]) =>
  mountSuspended(
    defineComponent({
      setup: () => () =>
        h(UApp, null, {
          default: () => h(PlaytimeSessionList, { sessions }),
        }),
    }),
  );

const makeSession = (
  overrides: Partial<PlaytimeSessionJson> = {},
): PlaytimeSessionJson => ({
  provider: "gog",
  providerId: 1423049311,
  providerName: "Cyberpunk 2077",
  minutes: 70,
  endedAfter: "2026-08-31T20:39:20.000Z",
  endedBefore: "2026-08-31T20:43:46.000Z",
  estimatedStart: "2026-08-31T19:33:46.000Z",
  estimatedEnd: "2026-08-31T20:43:46.000Z",
  uncertaintyMinutes: 70,
  anchored: false,
  playDay: "2026-08-31",
  ...overrides,
});

describe("PlaytimeSessionList", () => {
  it("renders a row per session", async () => {
    const component = await mount([
      makeSession(),
      makeSession({
        provider: "steam",
        minutes: 30,
        endedBefore: "2026-08-29T10:00:00.000Z",
        playDay: "2026-08-29",
      }),
    ]);

    expect(component.findAll("li")).toHaveLength(2);
  });

  it("groups sessions under a heading per play day", async () => {
    const component = await mount([
      makeSession(),
      makeSession({ provider: "steam", minutes: 30 }),
      makeSession({
        provider: "epic",
        minutes: 15,
        playDay: "2026-08-29",
      }),
    ]);

    const headings = component.findAll("h3").map((heading) => heading.text());
    expect(headings).toStrictEqual(["Monday 31 August", "Saturday 29 August"]);
    expect(component.findAll("section")[0]?.findAll("li")).toHaveLength(2);
  });

  it("marks an unanchored session as approximate", async () => {
    const component = await mount([makeSession()]);

    expect(component.text()).toContain("~1h 10m");
  });

  it("states an anchored session exactly", async () => {
    const component = await mount([
      makeSession({ provider: "steam", anchored: true }),
    ]);

    expect(component.text()).toContain("1h 10m");
    expect(component.text()).not.toContain("~");
  });

  it("shows the empty state when there are no sessions", async () => {
    const component = await mount([]);

    expect(component.text()).toContain("No sessions yet");
    expect(component.find("li").exists()).toBe(false);
  });
});
